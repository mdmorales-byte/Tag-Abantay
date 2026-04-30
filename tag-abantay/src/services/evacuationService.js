// src/services/evacuationService.js
import { supabase, TABLES } from './supabaseClient'

export const evacuationService = {
  /**
   * Get all active evacuation routes
   */
  async getEvacuationRoutes() {
    const { data, error } = await supabase
      .from(TABLES.EVACUATION_ROUTES)
      .select('*')
      .eq('is_active', true)
      .order('distance_from_campus_km', { ascending: true })

    if (error) throw error
    return { data, error: null }
  },

  /**
   * Get single evacuation route by ID
   */
  async getEvacuationRoute(routeId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.EVACUATION_ROUTES)
        .select('*')
        .eq('id', routeId)
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      // Silently handle - expected in demo mode
      return { data: null, error: null }
    }
  },

  /**
   * Create new evacuation route (admin only)
   */
  async createEvacuationRoute(routeData) {
    const { data, error } = await supabase
      .from(TABLES.EVACUATION_ROUTES)
      .insert({
        name: routeData.name,
        description: routeData.description,
        capacity: routeData.capacity,
        distance_from_campus_km: routeData.distance_from_campus_km,
        latitude: routeData.latitude,
        longitude: routeData.longitude,
        geojson: routeData.geojson,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  },

  /**
   * Update evacuation route (admin only)
   */
  async updateEvacuationRoute(routeId, updates) {
    const { data, error } = await supabase
      .from(TABLES.EVACUATION_ROUTES)
      .update(updates)
      .eq('id', routeId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  },

  /**
   * Delete evacuation route (admin only)
   */
  async deleteEvacuationRoute(routeId) {
    const { data, error } = await supabase
      .from(TABLES.EVACUATION_ROUTES)
      .update({ is_active: false })
      .eq('id', routeId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
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