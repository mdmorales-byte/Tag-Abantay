// src/services/authService.js
import { supabase, TABLES } from './supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const authService = {
  /**
   * Sign in with email and password - using direct fetch to avoid client issues
   */
  async signIn(email, password) {
    console.log('authService.signIn called with:', email)
    try {
      console.log('Using direct fetch to Supabase auth...')
      
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
      
      const data = await response.json()
      console.log('Direct auth response:', { status: response.status, data })
      
      if (!response.ok) {
        throw new Error(data.message || data.error_description || 'Login failed')
      }

      // Use default profile immediately - don't block on profile lookup
      let profile = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.email?.includes('admin') ? 'admin' : 'student',
        full_name: data.user.email?.split('@')[0] || 'User'
      }

      return { 
        user: data.user, 
        session: { access_token: data.access_token, user: data.user },
        profile: profile,
        error: null 
      }
    } catch (error) {
      console.error('Sign in error:', error)
      return { data: null, error }
    }
  },

  /**
   * Sign up new user (AdNU email only)
   */
  async signUp(email, password, fullName) {
    try {
      if (!email.endsWith('@adnu.edu.ph')) {
        throw new Error('Only AdNU email addresses are allowed (@adnu.edu.ph)')
      }

      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email, 
          password,
          data: { full_name: fullName }
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Sign up failed')
      }

      return { data, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { data: null, error }
    }
  },

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      return { error }
    }
  },

  /**
   * Get current session
   */
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return { session, error: null }
    } catch (error) {
      console.error('Get session error:', error)
      return { session: null, error }
    }
  },

  /**
   * Get current user
   */
  async getUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error

      if (user) {
        const profileResult = await this.getUserProfile(user.id)
        const profile = profileResult.data || {
          id: user.id,
          email: user.email,
          role: 'student',
          full_name: user.email?.split('@')[0] || 'User'
        }
        return { user, profile, error: null }
      }

      return { user: null, profile: null, error: null }
    } catch (error) {
      console.error('Get user error:', error)
      return { user: null, profile: null, error }
    }
  },

  /**
   * Get user profile from users table
   */
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Get user profile error:', error)
      return { data: null, error }
    }
  },

  /**
   * Update user profile
   */
  async updateUserProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Update profile error:', error)
      return { data: null, error }
    }
  },

  /**
   * Reset password
   */
  async resetPassword(email) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Reset password error:', error)
      return { data: null, error }
    }
  },

  /**
   * Update password
   */
  async updatePassword(newPassword) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Update password error:', error)
      return { data: null, error }
    }
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profileResult = await this.getUserProfile(session.user.id)
        const profile = profileResult.data || {
          id: session.user.id,
          email: session.user.email,
          role: 'student',
          full_name: session.user.email?.split('@')[0] || 'User'
        }
        callback(event, session, profile)
      } else {
        callback(event, session, null)
      }
    })
  }
}
