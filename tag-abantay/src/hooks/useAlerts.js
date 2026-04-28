// src/hooks/useAlerts.js
import { useState, useEffect } from 'react'
import { alertService } from '../services/alertService'

export const useAlerts = () => {
  const [currentAlert, setCurrentAlert] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadCurrentAlert()

    // Subscribe to real-time updates
    const channel = alertService.subscribeToAlerts((payload) => {
      console.log('Alert update:', payload)
      
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (payload.new?.is_active) {
          setCurrentAlert(payload.new)
        }
      } else if (payload.eventType === 'DELETE') {
        setCurrentAlert(null)
      }
    })

    return () => {
      alertService.unsubscribeFromAlerts(channel)
    }
  }, [])

  const loadCurrentAlert = async () => {
    try {
      setLoading(true)
      const { data, error } = await alertService.getCurrentAlert()
      
      if (error) throw error
      
      setCurrentAlert(data)
    } catch (err) {
      setError(err)
      console.error('Load alert error:', err)
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
    return currentAlert?.is_active || false
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