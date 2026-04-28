// src/services/alertService.js
import { supabase, TABLES, CHANNELS } from './supabaseClient'

export const alertService = {
  /**
   * Get current active alert
   */
  async getCurrentAlert() {
    try {
      const { data, error } = await supabase
        .from(TABLES.ALERTS)
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error
      
      // Return the first alert or null
      return { data: data?.[0] || null, error: null }
    } catch (error) {
      console.error('Get current alert error:', error)
      return { data: null, error }
    }
  },

  /**
   * Get all alerts (admin only)
   */
  async getAllAlerts(limit = 50) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ALERTS)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Get all alerts error:', error)
      return { data: null, error }
    }
  },

  /**
   * Create new alert (admin only)
   */
  async createAlert(alertData) {
    try {
      // Deactivate all existing alerts first
      await supabase
        .from(TABLES.ALERTS)
        .update({ is_active: false })
        .eq('is_active', true)

      // Create new alert
      const { data, error } = await supabase
        .from(TABLES.ALERTS)
        .insert({
          signal_level: alertData.signal_level,
          typhoon_name: alertData.typhoon_name,
          description: alertData.description,
          location: alertData.location || 'Naga City, Camarines Sur',
          is_active: true
        })
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Create alert error:', error)
      return { data: null, error }
    }
  },

  /**
   * Update existing alert (admin only)
   */
  async updateAlert(alertId, updates) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ALERTS)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', alertId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Update alert error:', error)
      return { data: null, error }
    }
  },

  /**
   * Deactivate alert (admin only)
   */
  async deactivateAlert(alertId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ALERTS)
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', alertId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Deactivate alert error:', error)
      return { data: null, error }
    }
  },

  /**
   * Subscribe to real-time alert updates
   */
  subscribeToAlerts(callback) {
    const channel = supabase
      .channel(CHANNELS.ALERTS)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: TABLES.ALERTS,
          filter: 'is_active=eq.true'
        },
        (payload) => {
          console.log('Alert update received:', payload)
          callback(payload)
        }
      )
      .subscribe((status) => {
        console.log('Alert subscription status:', status)
      })

    return channel
  },

  /**
   * Unsubscribe from alerts
   */
  async unsubscribeFromAlerts(channel) {
    if (channel) {
      await supabase.removeChannel(channel)
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