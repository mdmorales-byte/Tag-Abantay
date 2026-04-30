// src/hooks/useCheckIns.js
import { useState, useEffect } from 'react'
import { checkInService } from '../services/checkInService'

export const useCheckIns = (userId = null) => {
  const [checkIns, setCheckIns] = useState([])
  const [latestCheckIn, setLatestCheckIn] = useState(null)
  const [safetyStats, setSafetyStats] = useState({
    safe: 0,
    needsHelp: 0,
    unreachable: 0,
    notReported: 0,
    total_users: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadCheckIns()
    loadSafetyStats()

    // Subscribe to real-time check-in updates
    const channel = checkInService.subscribeToCheckIns((payload) => {
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
      // Silently handle - expected in demo mode
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const loadSafetyStats = async () => {
    try {
      const { data, error } = await checkInService.getSafetyStats()
      
      if (error) throw error
      
      // Normalize keys to camelCase for consistent usage across components
      setSafetyStats({
        safe: data?.safe || 0,
        needsHelp: data?.need_help || 0,
        unreachable: data?.unreachable || 0,
        notReported: data?.not_reported || 0,
        total_users: data?.total_users || 0
      })
    } catch (err) {
      // Silently handle - expected in demo mode
    }
  }

  const submitCheckIn = async (checkInData) => {
    try {
      setLoading(true)
      setError(null)
      
      // Ensure userId is always included - use passed userId or from checkInData
      const dataWithUser = {
        ...checkInData,
        userId: checkInData.userId || userId
      }
      
      const { data, error } = await checkInService.createCheckIn(dataWithUser)
      
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