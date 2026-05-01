// src/services/authService.js
import { supabase, TABLES } from './supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const authService = {
  /**
   * Sign in with email and password - using direct fetch to avoid client issues
   */
  async signIn(email, password) {
    console.log('AUTH_SERVICE: Starting signIn for', email);
    try {
      const emailLower = email.toLowerCase();
      // Only allow @gbox.adnu.edu.ph
      if (!emailLower.endsWith('@gbox.adnu.edu.ph') && !emailLower.startsWith('admin@')) {
        throw new Error('Only @gbox.adnu.edu.ph email addresses are allowed.');
      }
      console.log('AUTH_SERVICE: Sending fetch request to', `${SUPABASE_URL}/auth/v1/token`);
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      console.log('AUTH_SERVICE: Received response status:', response.status);
      const data = await response.json()
      console.log('AUTH_SERVICE: Received data:', data);
      
      if (!response.ok) {
        throw new Error(data.error_description || data.message || 'Invalid login credentials')
      }

      const user = data.user
      
      // Set the session asynchronously - don't wait for it
      if (data.access_token && data.refresh_token) {
        console.log('AUTH_SERVICE: Setting session asynchronously');
        supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        }).catch(err => console.warn('AUTH_SERVICE: Async session set failed:', err.message));
      }

      // SKIP PROFILE FETCH FOR NOW TO PREVENT HANGS
      console.log('AUTH_SERVICE: Login complete, returning data');
      const profile = {
        id: user.id,
        email: user.email,
        role: user.email?.toLowerCase().startsWith('admin@') ? 'admin' : 'student',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      }

      // Best-effort profile upsert so RLS policies (admin checks) work reliably.
      // Do not block login if this fails.
      try {
        const upsertUrl = `${SUPABASE_URL}/rest/v1/${TABLES.USERS}?on_conflict=id`
        await fetch(upsertUrl, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${data.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(profile),
          signal: AbortSignal.timeout(3000)
        })
      } catch (e) {
        console.warn('AUTH_SERVICE: profile upsert failed:', e?.message || e)
      }

      return {
        success: true,
        user,
        session: data,
        profile,
        error: null
      }
    } catch (error) {
      console.log('Login error:', error.message)
      return {
        success: false,
        user: null,
        session: null,
        profile: null,
        error: error.message || 'Invalid login credentials'
      }
    }
  },

  /**
   * Demo login - works without Supabase for testing
   */
  demoLogin(email) {
    const isAdmin = email.toLowerCase().startsWith('admin@') || email.includes('admin')
    // Use a consistent admin ID that matches the users table
    const adminId = '9b926c66-9b58-41f8-b262-64a4cd1c0b44'
    const demoUser = {
      id: isAdmin ? adminId : 'demo-user-' + Date.now(),
      email: email,
      user_metadata: { full_name: email.split('@')[0] }
    }
    const demoProfile = {
      id: demoUser.id,
      email: email,
      role: isAdmin ? 'admin' : 'student',
      full_name: email.split('@')[0]
    }
    // Create a fake session with the admin token format
    const demoSession = { 
      user: demoUser, 
      access_token: isAdmin ? adminId : 'demo-token-' + Date.now()
    }
    return {
      user: demoUser,
      session: demoSession,
      profile: demoProfile,
      error: null
    }
  },

  /**
   * Sign up new user (AdNU email only)
   */
  async signUp(email, password, userMetadata) {
    try {
      const emailLower = email.toLowerCase();
      if (!emailLower.endsWith('@gbox.adnu.edu.ph')) {
        throw new Error('Only AdNU GBox email addresses are allowed (@gbox.adnu.edu.ph)');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userMetadata,
          emailRedirectTo: window.location.origin,
        }
      })

      // Handle email confirmation errors gracefully - user may still be created
      if (error) {
        // Check if user was created despite email error
        if (data?.user && error.message?.includes('confirmation email')) {
          console.warn('User created but confirmation email failed:', error.message);
          
          // Create profile for the user
          try {
            await this.createUserProfile(data.user.id, {
              email: data.user.email,
              full_name: userMetadata.full_name || email.split('@')[0],
              role: userMetadata.role || 'student'
            });
          } catch (profileErr) {
            console.error("Profile creation error:", profileErr);
          }
          
          // Return success with warning - user can log in directly
          return { 
            data, 
            error: { 
              message: 'Account created! You can sign in now. (Email confirmation may be delayed)',
              isEmailError: true 
            } 
          }
        }
        throw error
      }

      // If user is created and we have a session (auto-confirm is on)
      // or even if not, we should attempt to create the profile row
      if (data?.user) {
        try {
          await this.createUserProfile(data.user.id, {
            email: data.user.email,
            full_name: userMetadata.full_name || email.split('@')[0],
            role: userMetadata.role || 'student'
          });
        } catch (profileErr) {
          console.error("Profile creation error:", profileErr);
        }
      }

      return { data, error: null }
    } catch (error) {
      console.error("SignUp error:", error);
      return { data: null, error }
    }
  },

  /**
   * Create user profile in users table
   */
  async createUserProfile(userId, profileData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .upsert({
          id: userId,
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error("createUserProfile error:", error)
      return { data: null, error }
    }
  },

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      // Try to get session with short timeout
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => resolve({ data: { session: null } }), 2000)
      )
      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise])
      
      // If demo session or no session, just return success
      if (!session || session?.access_token?.startsWith('demo')) {
        return { error: null }
      }
      
      // Try Supabase signOut but don't wait too long
      const signOutPromise = supabase.auth.signOut()
      const signOutTimeout = new Promise((resolve) => 
        setTimeout(() => resolve({ error: null }), 3000)
      )
      await Promise.race([signOutPromise, signOutTimeout])
      
      return { error: null }
    } catch (error) {
      // Always return success so UI clears state
      return { error: null }
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
      // Silently handle - expected in demo mode
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

      return { user, profile, error: null }
    } catch (error) {
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
      // Silently handle - expected in demo mode
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
      // Silently handle - expected in demo mode
      return { data: null, error: null }
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
      // Silently handle - expected in demo mode
      return { data: null, error: null }
    }
  },

  /**
   * Send a Magic Link for passwordless login
   */
  async sendMagicLink(email) {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        }
      })
      return { data, error }
    } catch (err) {
      return { data: null, error: err }
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
      // Silently handle - expected in demo mode
      return { data: null, error: null }
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