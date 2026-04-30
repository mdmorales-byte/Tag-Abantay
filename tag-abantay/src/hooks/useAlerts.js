// src/hooks/useAlerts.js
import { useState, useEffect } from 'react'
import { alertService } from '../services/alertService'

export const useAlerts = () => {
  const [currentAlert, setCurrentAlert] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true
    let channel = null
    let pollInterval = null
    
    const setupSubscription = async () => {
      await loadCurrentAlert()
      
      if (!isMounted) return
      
      // Subscribe to real-time updates (for Supabase mode)
      channel = alertService.subscribeToAlerts((payload) => {
        if (!isMounted) return
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          if (payload.new?.is_active) {
            setCurrentAlert(payload.new)
          }
        } else if (payload.eventType === 'DELETE') {
          setCurrentAlert(null)
        }
      })
      
      // Always poll every 3 seconds to detect localStorage changes
      pollInterval = setInterval(() => {
        if (isMounted) {
          loadCurrentAlert()
        }
      }, 3000)
    }
    
    setupSubscription()

    return () => {
      isMounted = false
      if (channel) {
        alertService.unsubscribeFromAlerts(channel)
      }
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [])

  const loadCurrentAlert = async () => {
    try {
      setLoading(true)
      const { data, error } = await alertService.getCurrentAlert()
      
      if (error) throw error
      
      setCurrentAlert(data)
    } catch (err) {
      // Silently handle - expected in demo mode
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const createAlert = async (alertData) => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await alertService.createAlert(alertData)
      
      if (error) throw error
      
      setCurrentAlert(data)
      return { success: true, data }
    } catch (err) {
      setError(err)
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  const updateAlert = async (alertId, updates) => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await alertService.updateAlert(alertId, updates)
      
      if (error) throw error
      
      setCurrentAlert(data)
      return { success: true, data }
    } catch (err) {
      setError(err)
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  const deactivateAlert = async (alertId) => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await alertService.deactivateAlert(alertId)
      
      if (error) throw error
      
      setCurrentAlert(null)
      return { success: true, data }
    } catch (err) {
      setError(err)
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  const getAlertLevel = () => {
    return currentAlert?.signal_level || 0
  }

  const getAlertInfo = () => {
    return alertService.getAlertLevelInfo(getAlertLevel())
  }

  const isAlertActive = () => {
    return !!currentAlert?.is_active
  }

  return {
    currentAlert,
    loading,
    error,
    createAlert,
    updateAlert,
    deactivateAlert,
    reload: loadCurrentAlert,
    alertLevel: getAlertLevel(),
    alertInfo: getAlertInfo(),
    isActive: isAlertActive()
  }
}