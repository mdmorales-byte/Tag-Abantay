// src/services/incidentService.js
import { supabase, TABLES, CHANNELS } from './supabaseClient'

export const incidentService = {
  /**
   * Create a new incident report
   */
  async createIncident(incidentData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User must be authenticated to report incident')
      }

      const { data, error } = await supabase
        .from(TABLES.INCIDENT_REPORTS)
        .insert({
          user_id: user.id,
          incident_type: incidentData.incident_type,
          description: incidentData.description,
          location: incidentData.location,
          latitude: incidentData.latitude,
          longitude: incidentData.longitude,
          severity: incidentData.severity || 'medium',
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Create incident error:', error)
      return { data: null, error }
    }
  },

  /**
   * Get user's incident reports
   */
  async getUserIncidents(userId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from(TABLES.INCIDENT_REPORTS)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Get user incidents error:', error)
      return { data: null, error }
    }
  },

  /**
   * Get all incidents (admin only)
   */
  async getAllIncidents(filters = {}) {
    try {
      let query = supabase
        .from(TABLES.INCIDENT_REPORTS)
        .select(`
          *,
          users (
            id,
            email,
            full_name,
            role
          )
        `)

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.incident_type) {
        query = query.eq('incident_type', filters.incident_type)
      }
      if (filters.severity) {
        query = query.eq('severity', filters.severity)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(filters.limit || 100)

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Get all incidents error:', error)
      return { data: null, error }
    }
  },

  /**
   * Update incident status (admin only)
   */
  async updateIncidentStatus(incidentId, status, notes) {
    try {
      const { data, error } = await supabase
        .from(TABLES.INCIDENT_REPORTS)
        .update({
          status,
          admin_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Update incident status error:', error)
      return { data: null, error }
    }
  },

  /**
   * Get incident statistics
   */
  async getIncidentStats() {
    try {
      const { data, error } = await supabase
        .from(TABLES.INCIDENT_REPORTS)
        .select('incident_type, severity, status')

      if (error) throw error

      const stats = {
        total: data?.length || 0,
        by_type: {},
        by_severity: {},
        by_status: {}
      }

      data?.forEach(incident => {
        // Count by type
        stats.by_type[incident.incident_type] = 
          (stats.by_type[incident.incident_type] || 0) + 1

        // Count by severity
        stats.by_severity[incident.severity] = 
          (stats.by_severity[incident.severity] || 0) + 1

        // Count by status
        stats.by_status[incident.status] = 
          (stats.by_status[incident.status] || 0) + 1
      })

      return { data: stats, error: null }
    } catch (error) {
      console.error('Get incident stats error:', error)
      return { data: null, error }
    }
  },

  /**
   * Subscribe to real-time incident updates
   */
  subscribeToIncidents(callback) {
    const channel = supabase
      .channel(CHANNELS.INCIDENTS)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: TABLES.INCIDENT_REPORTS 
        },
        async (payload) => {
          console.log('Incident update received:', payload)
          
          // Fetch user info for the incident
          if (payload.new?.user_id) {
            const { data: userData } = await supabase
              .from(TABLES.USERS)
              .select('id, email, full_name, role')
              .eq('id', payload.new.user_id)
              .single()

            callback({
              ...payload,
              new: {
                ...payload.new,
                users: userData
              }
            })
          } else {
            callback(payload)
          }
        }
      )
      .subscribe((status) => {
        console.log('Incident subscription status:', status)
      })

    return channel
  },

  /**
   * Unsubscribe from incidents
   */
  async unsubscribeFromIncidents(channel) {
    if (channel) {
      await supabase.removeChannel(channel)
    }
  }
}