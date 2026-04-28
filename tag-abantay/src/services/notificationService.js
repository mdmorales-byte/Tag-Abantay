// src/services/notificationService.js
import { supabase } from './supabaseClient'

/**
 * Notification Service implementing the Facade Pattern
 * Unifies Web Push, In-App Alerts, and future notification channels
 */
export const notificationService = {
  /**
   * Initialize notification service
   */
  async initialize() {
    // Skip service worker registration in development (no sw.js file)
    // In production, this would be enabled with proper VAPID keys
    return { success: false, error: 'Service worker disabled in development' }
  },

  /**
   * Request notification permission
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications')
      return 'denied'
    }

    const permission = await Notification.requestPermission()
    console.log('Notification permission:', permission)
    return permission
  },

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush() {
    try {
      const permission = await this.requestPermission()
      
      if (permission !== 'granted') {
        throw new Error('Notification permission denied')
      }

      const registration = await navigator.serviceWorker.ready
      
      // Get VAPID public key from environment
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured')
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      })

      // Save subscription to Supabase
      await this.saveSubscription(subscription)

      return { success: true, subscription }
    } catch (error) {
      console.error('Push subscription failed:', error)
      return { success: false, error }
    }
  },

  /**
   * Save push subscription to database
   */
  async saveSubscription(subscription) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // In a real implementation, you'd save this to a push_subscriptions table
      // For now, we'll store it in the user's metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          push_subscription: JSON.stringify(subscription)
        }
      })

      if (error) throw error
      
      console.log('Push subscription saved')
      return { success: true }
    } catch (error) {
      console.error('Save subscription error:', error)
      return { success: false, error }
    }
  },

  /**
   * Send browser notification (local)
   */
  async sendLocalNotification(title, options = {}) {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported')
      return
    }

    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/shield.svg',
        badge: '/shield.svg',
        ...options
      })

      notification.onclick = (event) => {
        event.preventDefault()
        window.focus()
        notification.close()
      }

      return notification
    }
  },

  /**
   * Send alert notification (Facade method)
   * Handles multiple notification channels
   */
  async sendAlert(alertData) {
    const { title, message, priority = 'normal' } = alertData

    const options = {
      body: message,
      icon: '/shield.svg',
      badge: '/shield.svg',
      tag: 'typhoon-alert',
      requireInteraction: priority === 'urgent',
      vibrate: priority === 'urgent' ? [200, 100, 200] : [100],
      data: alertData
    }

    // Send local notification
    await this.sendLocalNotification(title, options)

    // If urgent, also show in-app alert
    if (priority === 'urgent') {
      this.showInAppAlert(title, message)
    }

    // Future: Send SMS for critical alerts
    // if (priority === 'urgent') {
    //   await this.sendSMS(message)
    // }
  },

  /**
   * Show in-app alert
   */
  showInAppAlert(title, message) {
    // Dispatch custom event for in-app alerts
    const event = new CustomEvent('tagabantay-alert', {
      detail: { title, message }
    })
    window.dispatchEvent(event)
  },

  /**
   * Check notification support
   */
  isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator
  },

  /**
   * Get notification permission status
   */
  getPermissionStatus() {
    if (!('Notification' in window)) {
      return 'unsupported'
    }
    return Notification.permission
  },

  /**
   * Utility: Convert VAPID key
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }
}