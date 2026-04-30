// src/services/alertService.js
import { supabase, TABLES, CHANNELS } from './supabaseClient'

// Supabase config for direct API calls
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Helper function for direct Supabase REST API calls with timeout
async function supabaseFetch(table, options = {}) {
  const {
    method = 'GET',
    body = null,
    id = null,
    select = '*',
    query = null
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
  
  if (id) {
    url += `&id=eq.${encodeURIComponent(id)}`
  }
  
  if (query) {
    url += `&${query}`
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Prefer': (method === 'POST' || method === 'PATCH') ? 'return=representation' : undefined
  }

  const fetchOptions = {
    method,
    headers,
    signal: AbortSignal.timeout(3000) // 3 second timeout
  }

  if (body) {
    fetchOptions.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, fetchOptions)
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    // Return array for GET requests, single object for POST/PATCH
    if (method === 'GET') {
      return { data: Array.isArray(data) ? data : (data ? [data] : []), error: null }
    }
    return { data: data?.[0] || data || null, error: null }
  } catch (error) {
    console.warn(`Alert Fetch timeout/error (${table}):`, error.message)
    return { data: method === 'GET' ? [] : null, error: error.message }
  }
}

export const alertService = {
  /**
   * Get current active alert
   */
  async getCurrentAlert() {
    const result = await supabaseFetch(TABLES.ALERTS, {
      query: 'is_active=eq.true',
      select: '*'
    })
    return { data: result.data?.[0] || null, error: result.error }
  },

  /**
   * Get all alerts (admin only)
   */
  async getAllAlerts(limit = 50) {
    return await supabaseFetch(TABLES.ALERTS, {
      query: `limit=${limit}&order=created_at.desc`,
      select: '*'
    })
  },

  /**
   * Create new alert (admin only)
   */
  async createAlert(alertData) {
    // 1. Deactivate all existing alerts first (PATCH request)
    await supabaseFetch(TABLES.ALERTS, {
      method: 'PATCH',
      query: 'is_active=eq.true',
      body: { is_active: false }
    })

    // 2. Create the new alert
    return await supabaseFetch(TABLES.ALERTS, {
      method: 'POST',
      body: {
        signal_level: alertData.signal_level,
        typhoon_name: alertData.typhoon_name,
        description: alertData.description,
        location: alertData.location || 'Naga City, Camarines Sur',
        is_active: true
      }
    })
  },

  /**
   * Update existing alert (admin only)
   */
  async updateAlert(alertId, updates) {
    return await supabaseFetch(TABLES.ALERTS, {
      method: 'PATCH',
      id: alertId,
      body: { ...updates, updated_at: new Date().toISOString() }
    })
  },

  /**
   * Deactivate alert (admin only)
   */
  async deactivateAlert(alertId) {
    return await supabaseFetch(TABLES.ALERTS, {
      method: 'PATCH',
      id: alertId,
      body: { is_active: false, updated_at: new Date().toISOString() }
    })
  },

  /**
   * Reactivate alert (deactivates all others first)
   */
  async reactivateAlert(alertId) {
    // 1. Deactivate all other alerts
    await supabaseFetch(TABLES.ALERTS, {
      method: 'PATCH',
      query: 'is_active=eq.true',
      body: { is_active: false }
    })

    // 2. Reactivate this one
    return await supabaseFetch(TABLES.ALERTS, {
      method: 'PATCH',
      id: alertId,
      body: { is_active: true, updated_at: new Date().toISOString() }
    })
  },

  /**
   * Delete alert (admin only)
   */
  async deleteAlert(alertId) {
    const response = await supabaseFetch(TABLES.ALERTS, {
      method: 'DELETE',
      id: alertId
    })
    return { success: !response.error, error: response.error }
  },

  /**
   * Subscribe to real-time alert updates
   */
  subscribeToAlerts(callback) {
    try {
      // Use a unique channel name with timestamp to avoid conflicts
      const channelName = `${CHANNELS.ALERTS}-${Date.now()}`
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: TABLES.ALERTS
          },
          (payload) => {
            callback(payload)
          }
        )
        .subscribe((status) => {
          // Handle subscription status silently
        })

      return channel
    } catch {
      // Return null if subscription fails - will use polling instead
      return null
    }
  },

  /**
   * Unsubscribe from alerts
   */
  async unsubscribeFromAlerts(channel) {
    if (channel) {
      try {
        await supabase.removeChannel(channel)
      } catch {
        // Silently handle unsubscribe errors
      }
    }
  },

  /**
   * Get alert level info
   */
  getAlertLevelInfo(level) {
    const levels = {
      0: {
        name: 'No Signal',
        color: 'bg-gray-600',
        textColor: 'text-gray-600',
        description: 'No typhoon warning in effect',
        icon: '☁️'
      },
      1: {
        name: 'Signal No. 1',
        color: 'bg-yellow-500',
        textColor: 'text-yellow-500',
        description: 'Winds of 30-60 km/h expected in 36 hours',
        icon: '🌤️'
      },
      2: {
        name: 'Signal No. 2',
        color: 'bg-orange-500',
        textColor: 'text-orange-500',
        description: 'Winds of 60-90 km/h expected in 24 hours',
        icon: '🌥️'
      },
      3: {
        name: 'Signal No. 3',
        color: 'bg-red-500',
        textColor: 'text-red-500',
        description: 'Winds of 90-120 km/h expected in 18 hours',
        icon: '⛈️'
      },
      4: {
        name: 'Signal No. 4',
        color: 'bg-red-700',
        textColor: 'text-red-700',
        description: 'Winds of 120-170 km/h expected in 12 hours',
        icon: '🌪️'
      },
      5: {
        name: 'Signal No. 5',
        color: 'bg-red-900',
        textColor: 'text-red-900',
        description: 'Winds over 170 km/h expected in 12 hours',
        icon: '🌀'
      }
    }

    return levels[level] || levels[0]
  }
}