// src/services/alertService.js
import { supabase, TABLES, CHANNELS } from './supabaseClient'

// Supabase config for direct API calls
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Helper function for direct Supabase REST API calls
async function supabaseFetch(table, options = {}) {
  const {
    method = 'GET',
    body = null,
    id = null,
    select = '*',
    query = null
  } = options

  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`
  
  if (id) {
    url += `&id=eq.${encodeURIComponent(id)}`
  }
  
  if (query) {
    url += `&${query}`
  }

  // Get current user session for authenticated requests
  const { data: { session } } = await supabase.auth.getSession()
  const userToken = session?.access_token || SUPABASE_ANON_KEY

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Prefer': 'return=representation'
  }

  const fetchOptions = {
    method,
    headers
  }

  if (body) {
    fetchOptions.body = JSON.stringify(body)
  }

  // Add timeout to prevent hanging
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  fetchOptions.signal = controller.signal

  try {
    const response = await fetch(url, fetchOptions)
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || `HTTP ${response.status}`)
    }

    const data = await response.json()
    // Return array for GET requests, single object for POST/PATCH
    if (method === 'GET') {
      return { data: data || [], error: null }
    }
    return { data: data?.[0] || null, error: null }
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// LocalStorage key for demo alerts
const DEMO_ALERTS_KEY = 'tag-abantay-demo-alerts'

// Get demo alerts from localStorage
const getDemoAlerts = () => {
  try {
    const stored = localStorage.getItem(DEMO_ALERTS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Save demo alerts to localStorage
const saveDemoAlerts = (alerts) => {
  try {
    localStorage.setItem(DEMO_ALERTS_KEY, JSON.stringify(alerts))
  } catch {
    // Ignore storage errors
  }
}

export const alertService = {
  /**
   * Get current active alert
   */
  async getCurrentAlert() {
    // Use localStorage for immediate functionality
    const alerts = getDemoAlerts()
    const active = alerts.find(a => a.is_active) || null
    console.log('getCurrentAlert from localStorage:', active?.typhoon_name || 'none');
    return { data: active, error: null }
  },

  /**
   * Get all alerts (admin only)
   */
  async getAllAlerts(limit = 50) {
    // Use localStorage for immediate functionality
    const alerts = getDemoAlerts().slice(0, limit)
    console.log('getAllAlerts from localStorage:', alerts.length, 'alerts');
    return { data: alerts, error: null }
  },

  /**
   * Create new alert (admin only)
   */
  async createAlert(alertData) {
    // Use localStorage for immediate functionality
    const alerts = getDemoAlerts()
    // Deactivate all existing alerts
    const updatedAlerts = alerts.map(a => ({ ...a, is_active: false }))
    
    const newAlert = {
      id: 'demo-alert-' + Date.now(),
      signal_level: alertData.signal_level,
      typhoon_name: alertData.typhoon_name,
      description: alertData.description,
      location: alertData.location || 'Naga City, Camarines Sur',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    updatedAlerts.unshift(newAlert)
    saveDemoAlerts(updatedAlerts)
    console.log('Alert created in localStorage:', newAlert);
    return { data: newAlert, error: null }
  },

  /**
   * Update existing alert (admin only)
   */
  async updateAlert(alertId, updates) {
    // Use localStorage for immediate functionality
    const alerts = getDemoAlerts()
    const index = alerts.findIndex(a => a.id === alertId)
    if (index !== -1) {
      alerts[index] = { ...alerts[index], ...updates, updated_at: new Date().toISOString() }
      saveDemoAlerts(alerts)
      console.log('Alert updated in localStorage:', alerts[index]);
      return { data: alerts[index], error: null }
    }
    return { data: null, error: null }
  },

  /**
   * Deactivate alert (admin only)
   */
  async deactivateAlert(alertId) {
    // Use localStorage for immediate functionality
    const alerts = getDemoAlerts()
    const index = alerts.findIndex(a => a.id === alertId)
    if (index !== -1) {
      alerts[index] = { ...alerts[index], is_active: false, updated_at: new Date().toISOString() }
      saveDemoAlerts(alerts)
      console.log('Alert deactivated in localStorage:', alerts[index]);
      return { data: alerts[index], error: null }
    }
    return { data: null, error: null }
  },

  /**
   * Reactivate alert (deactivates all others first)
   */
  async reactivateAlert(alertId) {
    // Use localStorage for immediate functionality
    const alerts = getDemoAlerts()
    
    // Deactivate all other alerts first
    const updatedAlerts = alerts.map(a => ({ ...a, is_active: false }))
    
    // Reactivate the selected alert
    const index = updatedAlerts.findIndex(a => a.id === alertId)
    if (index !== -1) {
      updatedAlerts[index] = { 
        ...updatedAlerts[index], 
        is_active: true, 
        updated_at: new Date().toISOString() 
      }
      saveDemoAlerts(updatedAlerts)
      console.log('Alert reactivated in localStorage:', updatedAlerts[index]);
      return { data: updatedAlerts[index], error: null }
    }
    return { data: null, error: null }
  },

  /**
   * Delete alert (admin only)
   */
  async deleteAlert(alertId) {
    // Use localStorage for immediate functionality
    const alerts = getDemoAlerts()
    const updatedAlerts = alerts.filter(a => a.id !== alertId)
    saveDemoAlerts(updatedAlerts)
    console.log('Alert deleted from localStorage:', alertId);
    return { success: true, error: null }
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