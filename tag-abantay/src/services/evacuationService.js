// src/services/evacuationService.js
import { supabase, TABLES } from './supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Helper function for direct Supabase REST API calls with timeout
async function supabaseFetch(table, options = {}) {
  const {
    method = 'GET',
    body = null,
    select = '*',
    order = null,
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
  if (order) url += `&order=${encodeURIComponent(order)}`
  if (eq) url += `&${encodeURIComponent(eq.column)}=eq.${encodeURIComponent(eq.value)}`

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        'Prefer': (method === 'POST' || method === 'PATCH') ? 'return=representation' : undefined
      },
      body: body ? JSON.stringify(body) : null,
      signal: AbortSignal.timeout(3000) // 3 second timeout
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return { data: Array.isArray(data) ? data : (data ? [data] : []), error: null }
  } catch (error) {
    console.warn(`Evacuation Fetch Error (${table}):`, error.message)
    return { data: [], error: error.message }
  }
}

export const evacuationService = {
  /**
   * Get all active evacuation routes
   */
  async getEvacuationRoutes() {
    return await supabaseFetch(TABLES.EVACUATION_ROUTES, {
      eq: { column: 'is_active', value: 'true' },
      order: 'distance_from_campus_km.asc'
    })
  },

  /**
   * Get single evacuation route by ID
   */
  async getEvacuationRoute(routeId) {
    const result = await supabaseFetch(TABLES.EVACUATION_ROUTES, {
      eq: { column: 'id', value: routeId }
    })
    return { data: result.data?.[0] || null, error: result.error }
  },

  /**
   * Create new evacuation route (admin only)
   */
  async createEvacuationRoute(routeData) {
    const result = await supabaseFetch(TABLES.EVACUATION_ROUTES, {
      method: 'POST',
      body: {
        name: routeData.name,
        description: routeData.description,
        capacity: routeData.capacity,
        distance_from_campus_km: routeData.distance_from_campus_km,
        latitude: routeData.latitude,
        longitude: routeData.longitude,
        geojson: routeData.geojson,
        is_active: true
      }
    })
    return { data: result.data?.[0] || null, error: result.error }
  },

  /**
   * Update evacuation route (admin only)
   */
  async updateEvacuationRoute(routeId, updates) {
    const result = await supabaseFetch(TABLES.EVACUATION_ROUTES, {
      method: 'PATCH',
      eq: { column: 'id', value: routeId },
      body: updates
    })
    return { data: result.data?.[0] || null, error: result.error }
  },

  /**
   * Delete evacuation route (admin only)
   */
  async deleteEvacuationRoute(routeId) {
    return await supabaseFetch(TABLES.EVACUATION_ROUTES, {
      method: 'PATCH',
      eq: { column: 'id', value: routeId },
      body: { is_active: false }
    })
  },

  /**
   * Get nearest evacuation center
   */
  async getNearestEvacuationCenter(userLat, userLng) {
    try {
      const { data: routes, error } = await this.getEvacuationRoutes()
      
      if (error) throw error

      if (!routes || routes.length === 0) {
        return { data: null, error: null }
      }

      // Simple distance calculation (can be improved with actual routing)
      const routesWithDistance = routes.map(route => {
        // If route has geojson coordinates, use those
        if (route.geojson?.coordinates) {
          const [lng, lat] = route.geojson.coordinates
          const distance = this.calculateDistance(userLat, userLng, lat, lng)
          return { ...route, calculated_distance: distance }
        }
        return { ...route, calculated_distance: route.distance_from_campus_km }
      })

      // Sort by distance
      routesWithDistance.sort((a, b) => a.calculated_distance - b.calculated_distance)

      return { data: routesWithDistance[0], error: null }
    } catch (error) {
      // Silently handle - expected in demo mode
      return { data: null, error: null }
    }
  },

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371 // Radius of Earth in kilometers
    const dLat = this.toRad(lat2 - lat1)
    const dLon = this.toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c
    return distance
  },

  toRad(degrees) {
    return degrees * (Math.PI / 180)
  },

  /**
   * Subscribe to real-time evacuation route updates
   */
  subscribeToRoutes(callback) {
    try {
      // Use a unique channel name with timestamp to avoid conflicts
      const channelName = `evacuation-routes-${Date.now()}`
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: TABLES.EVACUATION_ROUTES
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
   * Unsubscribe from evacuation routes
   */
  async unsubscribeFromRoutes(channel) {
    if (channel) {
      try {
        await supabase.removeChannel(channel)
      } catch {
        // Silently handle unsubscribe errors
      }
    }
  }
}