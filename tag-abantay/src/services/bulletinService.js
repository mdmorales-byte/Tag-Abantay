// src/services/bulletinService.js
import { supabase, TABLES } from './supabaseClient'

// Helper to handle permission errors gracefully
function handlePermissionError(error, fallbackData = []) {
  if (error?.message?.includes('permission denied') || error?.code === '403' || error?.message?.includes('timeout')) {
    // Silently return fallback data - expected when Supabase is unavailable
    return { success: true, data: fallbackData }
  }
  return { success: false, error }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Helper function for direct Supabase REST API calls
async function supabaseFetch(table, options = {}) {
  const {
    method = 'GET',
    body = null,
    select = '*',
    order = null,
    limit = null,
    eq = null,
    id = null
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

  if (userToken === SUPABASE_ANON_KEY) {
    console.warn('bulletinService: Using anon key (no user session token found)')
  }

  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`
  
  if (order) {
    url += `&order=${encodeURIComponent(order)}`
  }
  if (limit) {
    url += `&limit=${limit}`
  }
  if (eq) {
    url += `&${encodeURIComponent(eq.column)}=eq.${encodeURIComponent(eq.value)}`
  }
  if (id) {
    url += `&id=eq.${encodeURIComponent(id)}`
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
    headers,
    signal: AbortSignal.timeout(3000) // Aggressive 3 second timeout
  }

  if (body) {
    fetchOptions.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      let details = ''
      try {
        const text = await response.text()
        details = text
      } catch (_) {
        // ignore
      }

      // Try to extract a useful message from PostgREST/Supabase
      let message = `HTTP ${response.status}`
      try {
        const parsed = details ? JSON.parse(details) : null
        message = parsed?.message || parsed?.error_description || parsed?.hint || parsed?.details || message
      } catch (_) {
        // not JSON
        if (details) message = `${message}: ${details}`
      }

      throw new Error(message)
    }

    if (method === 'DELETE') return { data: null, error: null }

    const data = await response.json()
    return { data: Array.isArray(data) ? data : (data ? [data] : []), error: null }
  } catch (error) {
    console.warn(`Fetch timeout/error for ${table}:`, error.message)
    return { data: [], error: error.message }
  }
}


// Announcement Services
export const announcementService = {
  // Get all announcements
  async getAll() {
    const result = await supabaseFetch(TABLES.ANNOUNCEMENTS, {
      select: '*',
      order: 'created_at.desc',
      limit: 100
    })
    const data = (result.data || []).map(a => ({
      ...a,
      content: a?.content ?? a?.message
    }))
    return { success: true, data }
  },

  // Get latest announcements (limited)
  async getLatest(limit = 5) {
    const result = await supabaseFetch(TABLES.ANNOUNCEMENTS, {
      select: '*',
      order: 'created_at.desc',
      limit
    })
    const data = (result.data || []).map(a => ({
      ...a,
      content: a?.content ?? a?.message
    }))
    return { success: true, data }
  },

  // Create announcement
  async create({ title, content }) {
    const result = await supabaseFetch(TABLES.ANNOUNCEMENTS, {
      method: 'POST',
      // DB column is `message`; UI uses `content`
      body: { title, message: content },
      select: '*'
    })

    if (result.error) {
      return { success: false, error: result.error }
    }

    const row = result.data?.[0]
    return { success: true, data: row ? { ...row, content: row?.content ?? row?.message } : null }
  },

  // Update announcement
  async update(id, { title, content }) {
    const result = await supabaseFetch(TABLES.ANNOUNCEMENTS, {
      method: 'PATCH',
      body: { title, message: content, updated_at: new Date().toISOString() },
      id,
      select: '*'
    })
    const row = result.data?.[0]
    return { success: true, data: row ? { ...row, content: row?.content ?? row?.message } : null }
  },

  // Delete announcement
  async delete(id) {
    await supabaseFetch(TABLES.ANNOUNCEMENTS, {
      method: 'DELETE',
      id
    })
    return { success: true }
  },

  // Subscribe to real-time updates (disabled - using polling)
  subscribeToChanges(callback) {
    return { 
      unsubscribe: () => {},
      on: () => ({ subscribe: () => {} })
    }
  }
}


// Gallery Image Services
export const galleryService = {
  // Get all gallery images
  async getAll() {
    const result = await supabaseFetch(TABLES.GALLERY_IMAGES, {
      select: '*',
      order: 'created_at.desc',
      limit: 100
    })
    return { success: true, data: result.data || [] }
  },

  // Create gallery image (supports URL or base64 file data)
  async create({ url, caption, fileData }) {
    const result = await supabaseFetch(TABLES.GALLERY_IMAGES, {
      method: 'POST',
      body: { url: fileData || url, caption },
      select: '*'
    })
    return { success: true, data: result.data }
  },

  // Delete gallery image
  async delete(id) {
    await supabaseFetch(TABLES.GALLERY_IMAGES, {
      method: 'DELETE',
      id
    })
    return { success: true }
  },

  // Subscribe to real-time updates (disabled - using polling)
  subscribeToChanges(callback) {
    return { 
      unsubscribe: () => {},
      on: () => ({ subscribe: () => {} })
    }
  }
}

// Combined bulletin service
export const bulletinService = {
  announcements: announcementService,
  gallery: galleryService
}

export default bulletinService