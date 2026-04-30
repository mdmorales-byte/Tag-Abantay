// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create a simulated client for development without Supabase
const createSimulatedClient = () => {
  return {
    auth: {
      signInWithPassword: async () => ({ 
        data: { user: { email: 'user@adnu.edu.ph', id: 'simulated-user' }, session: { user: { email: 'user@adnu.edu.ph' } } }, 
        error: null 
      }),
      signUp: async () => ({ data: { user: { email: 'user@adnu.edu.ph' } }, error: null }),
      signOut: async () => ({ error: null }),
      getSession: async () => ({ 
        data: { 
          session: { 
            user: { 
              email: 'admin@adnu.edu.ph', 
              id: 'simulated-admin',
              role: 'admin'
            } 
          } 
        }, 
        error: null 
      }),
      getUser: async () => ({ data: { user: { email: 'user@adnu.edu.ph', id: 'simulated-user' } }, error: null }),
      updateUser: async () => ({ data: { user: {} }, error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      onAuthStateChange: (callback) => {
        callback('SIGNED_IN', { user: { email: 'user@adnu.edu.ph' } })
        return { subscription: { unsubscribe: () => {} } }
      }
    },
    from: (table) => ({
      select: (columns = '*') => ({
        eq: (column, value) => ({ 
          single: async () => { 
            // Return admin profile when querying users table
            if (table === 'users' && column === 'id') {
              return { 
                data: { 
                  id: value, 
                  email: 'admin@adnu.edu.ph', 
                  role: 'admin',
                  full_name: 'Admin User'
                }, 
                error: null 
              }
            }
            return { data: null, error: null } 
          },
          order: () => ({ limit: async () => ({ data: [], error: null }) })
        }),
        order: (column, opts) => ({ 
          limit: async () => ({ data: [], error: null }),
          gte: (col, val) => ({ 
            limit: async () => ({ data: [], error: null }),
            order: () => ({ limit: async () => ({ data: [], error: null }) })
          })
        }),
        gte: (column, value) => ({
          limit: async () => ({ data: [], error: null }),
          order: () => ({ limit: async () => ({ data: [], error: null }) })
        }),
        limit: async () => ({ data: [], error: null })
      }),
      insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }),
      delete: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) })
    }),
    channel: (name) => ({
      on: (event, filter, callback) => ({ 
        subscribe: (cb) => { 
          if (cb) cb('SUBSCRIBED')
          return { unsubscribe: () => {} }
        } 
      })
    }),
    removeChannel: async () => {}
  }
}

// Singleton pattern - create only one instance
let supabaseInstance = null
let useSimulatedMode = false

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (!url || !key) {
      supabaseInstance = createSimulatedClient()
      useSimulatedMode = true
    } else {
      // Disable ALL persistence to prevent storage locks and hangs
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: false, // DO NOT save to localStorage
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
          }
        }
      })
      useSimulatedMode = false
    }
  }
  return supabaseInstance
}

// Check if we're in simulated mode
export const isSimulatedMode = () => useSimulatedMode

// Export the client instance
export const supabase = getSupabaseClient()

// Constants
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase Helper Object for manual REST calls
export const supabaseHelper = {
  // Helper to get headers with the best available token
  getHeaders() {
    const saved = localStorage.getItem('manual_session');
    let token = SUPABASE_ANON_KEY;
    
    if (saved) {
      try {
        const session = JSON.parse(saved);
        // Check if session exists and has an access token
        if (session?.session?.access_token) {
          token = session.session.access_token;
        } else if (session?.access_token) {
          token = session.access_token;
        }
      } catch (e) {
        console.warn('supabaseClient: Failed to parse manual session');
      }
    }
    
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  },

  // Global fetch wrapper with automatic error handling for 401/expired JWT
  async safeFetch(url, options = {}) {
    const headers = this.getHeaders();
    const mergedOptions = {
      ...options,
      headers: { ...headers, ...options.headers }
    };

    try {
      const response = await fetch(url, mergedOptions);
      
      if (response.status === 401) {
        console.warn('supabaseClient: 401 Unauthorized detected. Session might be expired.');
        // If we get a 401, the token is definitely bad. Clear it.
        if (localStorage.getItem('manual_session')) {
          localStorage.removeItem('manual_session');
          // Dispatch event to notify the app to logout
          window.dispatchEvent(new CustomEvent('supabase-unauthorized'));
        }
      }
      
      return response;
    } catch (err) {
      throw err;
    }
  }
};

// Database table names
export const TABLES = {
  USERS: 'users',
  ALERTS: 'alerts',
  CHECK_INS: 'check_ins',
  INCIDENT_REPORTS: 'incident_reports',
  EVACUATION_ROUTES: 'evacuation_routes',
  ANNOUNCEMENTS: 'announcements',
  GALLERY_IMAGES: 'gallery_images'
}

// Realtime channels
export const CHANNELS = {
  ALERTS: 'alerts-channel',
  CHECK_INS: 'check-ins-channel',
  BULLETINS: 'bulletins-channel',
  INCIDENTS: 'incidents-channel',
  EVACUATION_ROUTES: 'evacuation-routes-channel'
}