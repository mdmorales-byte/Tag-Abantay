// src/services/bulletinService.js
import { TABLES } from './supabaseClient'

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
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : undefined
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
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  // DELETE returns empty body
  if (method === 'DELETE') {
    return { data: null, error: null }
  }

  const data = await response.json()
  return { data, error: null }
}

// Announcement Services
export const announcementService = {
  // Get all announcements
  async getAll() {
    try {
      const result = await supabaseFetch(TABLES.ANNOUNCEMENTS, {
        select: '*',
        order: 'created_at.desc',
        limit: 100
      })
      return { success: true, data: result.data }
    } catch (error) {
      console.error('Error fetching announcements:', error)
      return { success: false, error }
    }
  },

  // Get latest announcements (limited)
  async getLatest(limit = 5) {
    try {
      const result = await supabaseFetch(TABLES.ANNOUNCEMENTS, {
        select: '*',
        order: 'created_at.desc',
        limit
      })
      return { success: true, data: result.data }
    } catch (error) {
      console.error('Error fetching latest announcements:', error)
      return { success: false, error }
    }
  },

  // Create announcement
  async create({ title, content }) {
    try {
      const result = await supabaseFetch(TABLES.ANNOUNCEMENTS, {
        method: 'POST',
        body: { title, content },
        select: '*'
      })
      return { success: true, data: result.data?.[0] }
    } catch (error) {
      console.error('Error creating announcement:', error)
      return { success: false, error }
    }
  },

  // Update announcement
  async update(id, { title, content }) {
    try {
      const result = await supabaseFetch(TABLES.ANNOUNCEMENTS, {
        method: 'PATCH',
        body: { title, content, updated_at: new Date().toISOString() },
        id,
        select: '*'
      })
      return { success: true, data: result.data?.[0] }
    } catch (error) {
      console.error('Error updating announcement:', error)
      return { success: false, error }
    }
  },

  // Delete announcement
  async delete(id) {
    try {
      await supabaseFetch(TABLES.ANNOUNCEMENTS, {
        method: 'DELETE',
        id
      })
      return { success: true }
    } catch (error) {
      console.error('Error deleting announcement:', error)
      return { success: false, error }
    }
  },

  // Subscribe to real-time updates (disabled - using polling)
  subscribeToChanges(callback) {
    console.log('Realtime subscriptions disabled for announcements - using polling')
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
    try {
      const result = await supabaseFetch(TABLES.GALLERY_IMAGES, {
        select: '*',
        order: 'created_at.desc',
        limit: 100
      })
      return { success: true, data: result.data }
    } catch (error) {
      console.error('Error fetching gallery images:', error)
      return { success: false, error }
    }
  },

  // Create gallery image
  async create({ url, caption }) {
    try {
      const result = await supabaseFetch(TABLES.GALLERY_IMAGES, {
        method: 'POST',
        body: { url, caption },
        select: '*'
      })
      return { success: true, data: result.data?.[0] }
    } catch (error) {
      console.error('Error creating gallery image:', error)
      return { success: false, error }
    }
  },

  // Delete gallery image
  async delete(id) {
    try {
      await supabaseFetch(TABLES.GALLERY_IMAGES, {
        method: 'DELETE',
        id
      })
      return { success: true }
    } catch (error) {
      console.error('Error deleting gallery image:', error)
      return { success: false, error }
    }
  },

  // Subscribe to real-time updates (disabled - using polling)
  subscribeToChanges(callback) {
    console.log('Realtime subscriptions disabled for gallery - using polling')
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
