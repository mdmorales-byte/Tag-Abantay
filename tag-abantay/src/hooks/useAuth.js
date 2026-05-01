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
      setLoading(current => current ? false : current)
    }, 3000)

    // Listen for auth changes
    const { data: authListener } = authService.onAuthStateChange(
      async (event, session, profile) => {
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
    setLoading(true);
    try {
      // Check manual session first to avoid hanging library calls
      const saved = localStorage.getItem('manual_session');
      if (saved) {
        const result = JSON.parse(saved);
        setUser(result.user);
        setSession(result.session);
        setProfile(result.profile);
        console.log('useAuth: Recovered manual session');
      }
    } catch (err) {
      console.warn('useAuth: Manual session recovery failed', err);
    } finally {
      setLoading(false);
    }
  }

  const signIn = async (email, password) => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await authService.signIn(email, password)
      
      if (result.error) {
        throw result.error
      }

      setUser(result.user)
      setSession(result.session)
      setProfile(result.profile)
      
      // Manually save session to avoid Supabase library bugs
      localStorage.setItem('manual_session', JSON.stringify(result));
      
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
        // Handle email confirmation error as success - user was created
        if (result.error.isEmailError) {
          return { success: true, data: result.data, warning: result.error.message }
        }
        // Handle already registered user
        if (result.error.isExistingUser) {
          return { success: false, error: { message: result.error.message }, isExistingUser: true }
        }
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

  const sendMagicLink = async (email) => {
    try {
      setLoading(true)
      setError(null)
      const result = await authService.sendMagicLink(email)
      return result
    } catch (err) {
      setError(err)
      return { data: null, error: err }
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
    sendMagicLink,
    isAuthenticated: !!user,
    isAdmin: isAdmin(),
    isFaculty: isFaculty(),
    isStudent: isStudent()
  }
}