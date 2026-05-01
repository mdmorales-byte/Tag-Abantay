// src/services/checkInService.js
import { TABLES, CHANNELS, supabase } from './supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Helper function for direct Supabase REST API calls
async function supabaseFetch(table, options = {}) {
  const {
    method = 'GET',
    body = null,
    query = null,
    select = '*',
    order = null,
    limit = null,
    eq = null
  } = options

  // Get user's JWT token from manual session (since supabase persistence is disabled)
  let userToken = SUPABASE_ANON_KEY
  try {
    const saved = localStorage.getItem('manual_session')
    if (saved) {
      const sessionData = JSON.parse(saved)
      userToken = sessionData?.session?.access_token || sessionData?.access_token || SUPABASE_ANON_KEY
    }
  } catch (e) {
    // Fallback to anon key
  }

  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`
  
  if (query) {
    url += `&${query}`
  }
  if (order) {
    url += `&order=${order}`
  }
  if (limit) {
    url += `&limit=${limit}`
  }
  if (eq) {
    url += `&${encodeURIComponent(eq.column)}=eq.${encodeURIComponent(eq.value)}`
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Prefer': (method === 'POST' || method === 'PATCH') ? 'return=representation' : undefined
  }

  // Remove undefined headers
  Object.keys(headers).forEach(key => headers[key] === undefined && delete headers[key])

  const fetchOptions = {
    method,
    headers
  }

  if (body) {
    fetchOptions.body = JSON.stringify(body)
  }

  const response = await fetch(url, fetchOptions)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  const data = await response.json()
  return { data, error: null }
}

// Helper to handle permission errors gracefully
function handlePermissionError(error, fallbackData = []) {
  if (error?.message?.includes('permission denied') || error?.code === '403' || error?.message?.includes('timeout')) {
    // Silently return fallback data - expected when Supabase is unavailable
    return { data: fallbackData, error: null }
  }
  return { data: null, error }
}

export const checkInService = {
  /**
   * Create a new safety check-in
   */
  async createCheckIn(checkInData) {
    try {
      const result = await supabaseFetch(TABLES.CHECK_INS, {
        method: 'POST',
        body: {
          user_id: checkInData.userId,
          status: checkInData.status,
          location: checkInData.location,
          notes: checkInData.notes,
          latitude: checkInData.latitude,
          longitude: checkInData.longitude
        },
        select: '*'
      })

      return { success: true, data: result.data?.[0], error: null }
    } catch (error) {
      console.error("checkInService: createCheckIn failed:", error.message);
      return { success: false, data: null, error: error.message }
    }
  },

  /**
   * Get user's check-in history
   */
  async getUserCheckIns(userId, limit = 20) {
    try {
      const result = await supabaseFetch(TABLES.CHECK_INS, {
        select: '*',
        eq: { column: 'user_id', value: userId },
        order: 'created_at.desc',
        limit
      })
      return { data: result.data, error: null }
    } catch (error) {
      // Silently handle - expected in demo mode
      return { data: null, error: null }
    }
  },

  /**
   * Get user's latest check-in
   */
  async getLatestCheckIn(userId) {
    try {
      const result = await supabaseFetch(TABLES.CHECK_INS, {
        select: '*',
        eq: { column: 'user_id', value: userId },
        order: 'created_at.desc',
        limit: 1
      })
      return { data: result.data?.[0] || null, error: null }
    } catch (error) {
      // Silently handle - expected in demo mode
      return { data: null, error: null }
    }
  },

  /**
   * Get all check-ins with user info (admin only)
   */
  async getAllCheckIns(limit = 100) {
    try {
      // First get check-ins
      const checkInsResult = await supabaseFetch(TABLES.CHECK_INS, {
        select: '*',
        order: 'created_at.desc',
        limit
      })

      if (!checkInsResult.data?.length) {
        return { data: [], error: null }
      }

      // Get all user IDs from check-ins
      const userIds = [...new Set(checkInsResult.data.map(c => c.user_id))]
      
      // Fetch users separately
      const usersPromises = userIds.map(id => 
        supabaseFetch(TABLES.USERS, {
          select: 'id,email,full_name,role',
          eq: { column: 'id', value: id },
          limit: 1
        }).catch(() => ({ data: [] }))
      )
      
      const usersResults = await Promise.all(usersPromises)
      const usersMap = {}
      usersResults.forEach((result, index) => {
        if (result.data?.[0]) {
          usersMap[userIds[index]] = result.data[0]
        }
      })

      // Merge user data with check-ins
      const mergedData = checkInsResult.data.map(checkIn => ({
        ...checkIn,
        users: usersMap[checkIn.user_id] || null
      }))

      return { data: mergedData, error: null }
    } catch (error) {
      return handlePermissionError(error, [])
    }
  },

  /**
   * Get safety statistics
   */
  async getSafetyStats() {
    try {
      // Get total users count
      const usersResult = await supabaseFetch(TABLES.USERS, {
        select: 'count',
        limit: 1000
      })
      const totalUsers = usersResult.data?.length || 0

      // Get check-ins from last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const checkInsResult = await supabaseFetch(TABLES.CHECK_INS, {
        select: 'user_id,status,created_at',
        query: `created_at=gte.${encodeURIComponent(twentyFourHoursAgo)}`,
        order: 'created_at.desc',
        limit: 1000
      })

      const recentCheckIns = checkInsResult.data || []

      // Get unique users who checked in (most recent status per user)
      const userStatusMap = new Map()
      recentCheckIns.forEach(checkIn => {
        if (!userStatusMap.has(checkIn.user_id)) {
          userStatusMap.set(checkIn.user_id, checkIn.status)
        }
      })

      // Count by status
      const stats = {
        safe: 0,
        need_help: 0,
        unreachable: 0,
        not_reported: 0,
        total_users: totalUsers
      }

      userStatusMap.forEach(status => {
        if (status === 'safe') stats.safe++
        else if (status === 'need_help') stats.need_help++
        else if (status === 'unreachable') stats.unreachable++
      })

      stats.not_reported = Math.max(0, stats.total_users - (stats.safe + stats.need_help + stats.unreachable))

      return { data: stats, error: null }
    } catch (error) {
      // Silently handle - expected in demo mode
      const fallback = {
        safe: 0,
        need_help: 0,
        unreachable: 0,
        not_reported: 0,
        total_users: 0
      }
      const handled = handlePermissionError(error, fallback)
      return { data: handled.data, error: handled.error }
    }
  },

  /**
   * Subscribe to real-time check-in updates (disabled - using polling instead)
   */
  subscribeToCheckIns(callback) {
    // Return dummy subscription (real-time disabled, using polling)
    return { 
      unsubscribe: () => {},
      on: () => ({ subscribe: () => {} })
    }
  },

  /**
   * Unsubscribe from check-ins (no-op for now)
   */
  async unsubscribeFromCheckIns(channel) {
    // No-op
  },

  /**
   * Get users who haven't checked in recently
   */
  async getUsersNotReported(hoursThreshold = 24) {
    try {
      const thresholdTime = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString()

      // Get all users
      const usersResult = await supabaseFetch(TABLES.USERS, {
        select: 'id,email,full_name,role',
        limit: 1000
      })
      const allUsers = usersResult.data || []

      // Get recent check-ins
      const checkInsResult = await supabaseFetch(TABLES.CHECK_INS, {
        select: 'user_id',
        query: `created_at=gte.${encodeURIComponent(thresholdTime)}`,
        limit: 1000
      })
      const recentCheckIns = checkInsResult.data || []

      // Find users who haven't checked in
      const checkedInUserIds = new Set(recentCheckIns.map(c => c.user_id))
      const notReported = allUsers.filter(user => !checkedInUserIds.has(user.id))

      return { data: notReported, error: null }
    } catch (error) {
      // Silently handle - expected in demo mode
      return handlePermissionError(error, [])
    }
  }
}