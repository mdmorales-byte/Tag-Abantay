// src/hooks/useAuth.js
import { useState, useEffect } from 'react'
import { authService } from '../services/authService'

export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Check current session on mount
    checkSession()

    // Safety timeout - force loading to false after 3 seconds
    const timeoutId = setTimeout(() => {
      setLoading(current => {
        if (current) {
          console.log('Forcing loading to false after timeout')
          return false
        }
        return current
      })
    }, 3000)

    // Listen for auth changes
    const { data: authListener } = authService.onAuthStateChange(
      async (event, session, profile) => {
        console.log('Auth state changed:', event)
        setSession(session)
        setUser(session?.user || null)
        setProfile(profile)
        setLoading(false)
      }
    )

    return () => {
      clearTimeout(timeoutId)
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  const checkSession = async () => {
    // Safety timeout - ensure loading is always set to false
    const timeoutId = setTimeout(() => {
      console.log('checkSession timeout - forcing loading false')
      setLoading(false)
    }, 4000)
    
    try {
      const { session } = await authService.getSession()
      setSession(session)
      setUser(session?.user || null)

      if (session?.user) {
        try {
          const { data: profile } = await authService.getUserProfile(session.user.id)
          setProfile(profile)
        } catch (profileErr) {
          console.warn('Profile fetch failed, using default:', profileErr)
          // Set a default profile so loading completes
          setProfile({
            id: session.user.id,
            email: session.user.email,
            role: 'student',
            full_name: session.user.email?.split('@')[0] || 'User'
          })
        }
      }
    } catch (err) {
      console.error('Session check error:', err)
      setError(err)
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    try {
      setLoading(true)
      setError(null)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Login request timed out. Please try again.')), 10000)
      })
      
      const result = await Promise.race([
        authService.signIn(email, password),
        timeoutPromise
      ])
      
      if (result.error) {
        throw result.error
      }

      setUser(result.user)
      setSession(result.session)
      setProfile(result.profile)
      
      return { success: true, user: result.user }
    } catch (err) {
      setError(err)
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password, fullName) => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await authService.signUp(email, password, fullName)
      
      if (result.error) {
        throw result.error
      }

      return { success: true, data: result.data }
    } catch (err) {
      setError(err)
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      setError(null)
      
      await authService.signOut()
      
      setUser(null)
      setSession(null)
      setProfile(null)
      
      return { success: true }
    } catch (err) {
      setError(err)
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates) => {
    try {
      if (!user) {
        throw new Error('No user logged in')
      }

      setLoading(true)
      setError(null)
      
      const { data, error } = await authService.updateUserProfile(user.id, updates)
      
      if (error) throw error

      setProfile(data)
      
      return { success: true, data }
    } catch (err) {
      setError(err)
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  const updatePassword = async (newPassword) => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await authService.updatePassword(newPassword)
      
      if (error) throw error

      return { success: true, data }
    } catch (err) {
      setError(err)
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = () => {
    return profile?.role === 'admin'
  }

  const isFaculty = () => {
    return profile?.role === 'faculty'
  }

  const isStudent = () => {
    return profile?.role === 'student'
  }

  return {
    user,
    profile,
    session,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    updateProfile,
    updatePassword,
    isAuthenticated: !!user,
    isAdmin: isAdmin(),
    isFaculty: isFaculty(),
    isStudent: isStudent()
  }
}