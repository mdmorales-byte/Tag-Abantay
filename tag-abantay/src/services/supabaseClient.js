// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing')
console.log('Supabase Key:', supabaseAnonKey ? 'Found (first 20 chars: ' + supabaseAnonKey.substring(0, 20) + '...)' : 'Missing')

// Create a simulated client for development without Supabase
const createSimulatedClient = () => {
  console.warn('Using simulated Supabase client. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for real backend.')
  
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

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    // Use simulated client if env vars are missing
    if (!supabaseUrl || !supabaseAnonKey) {
      supabaseInstance = createSimulatedClient()
    } else {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      })
    }
  }
  return supabaseInstance
}

// Export the client instance
export const supabase = getSupabaseClient()

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
  ANNOUNCEMENTS: 'announcements-channel',
  INCIDENTS: 'incidents-channel'
}