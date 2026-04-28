// src/hooks/useCheckIns.js
import { useState, useEffect } from 'react'
import { checkInService } from '../services/checkInService'

export const useCheckIns = (userId = null) => {
  const [checkIns, setCheckIns] = useState([])
  const [latestCheckIn, setLatestCheckIn] = useState(null)
  const [safetyStats, setSafetyStats] = useState({
    safe: 0,
    need_help: 0,
    unreachable: 0,
    not_reported: 0,
    total_users: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadCheckIns()
    loadSafetyStats()

    // Subscribe to real-time check-in updates
    const channel = checkInService.subscribeToCheckIns((payload) => {
      console.log('New check-in:', payload)
      
      // Add new check-in to the list
      setCheckIns(prev => [payload.new, ...prev])
      
      // Reload stats
      loadSafetyStats()
    })

    return () => {
      checkInService.unsubscribeFromCheckIns(channel)
    }
  }, [userId])

  const loadCheckIns = async () => {
    try {
      setLoading(true)
      
      let result
      if (userId) {
        result = await checkInService.getUserCheckIns(userId)
        const latest = await checkInService.getLatestCheckIn(userId)
        setLatestCheckIn(latest.data)
      } else {
        result = await checkInService.getAllCheckIns()
      }
      
      if (result.error) throw result.error
      
      setCheckIns(result.data || [])
    } catch (err) {
      setError(err)
      console.error('Load check-ins error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadSafetyStats = async () => {
    try {
      const { data, error } = await checkInService.getSafetyStats()
      
      if (error) throw error
      
      setSafetyStats(data)
    } catch (err) {
      console.error('Load safety stats error:', err)
    }
  }

  const submitCheckIn = async (checkInData) => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await checkInService.createCheckIn(checkInData)
      
      if (error) throw error
      
      // Update local state
      setCheckIns(prev => [data, ...prev])
      setLatestCheckIn(data)
      
      // Reload stats
      await loadSafetyStats()
      
      return { success: true, data }
    } catch (err) {
      setError(err)
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  const getUsersNotReported = async (hours = 24) => {
    try {
      const { data, error } = await checkInService.getUsersNotReported(hours)
      
      if (error) throw error
      
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err }
    }
  }

  return {
    checkIns,
    latestCheckIn,
    safetyStats,
    loading,
    error,
    submitCheckIn,
    getUsersNotReported,
    reload: loadCheckIns,
    reloadStats: loadSafetyStats
  }
}