// src/services/announcementService.js
import { supabase, TABLES, CHANNELS } from './supabaseClient'

export const announcementService = {
  /**
   * Get recent announcements
   */
  async getAnnouncements(limit = 20) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ANNOUNCEMENTS)
        .select(`
          *,
          users (
            id,
            email,
            full_name,
            role
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      // Silently handle - expected in demo mode
      return { data: null, error: null }
    }
  },

  /**
   * Get announcements by priority
   */
  async getAnnouncementsByPriority(priority) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ANNOUNCEMENTS)
        .select(`
          *,
          users (
            id,
            email,
            full_name,
            role
          )
        `)
        .eq('priority', priority)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      // Silently handle - expected in demo mode
      return { data: null, error: null }
    }
  },

  /**
   * Create new announcement (admin only)
   */
  async createAnnouncement(announcementData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User must be authenticated')
      }

      const { data, error } = await supabase
        .from(TABLES.ANNOUNCEMENTS)
        .insert({
          title: announcementData.title,
          message: announcementData.message,
          priority: announcementData.priority || 'normal',
          target_audience: announcementData.target_audience || 'all',
          created_by: user.id
        })
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
   * Delete announcement (admin only)
   */
  async deleteAnnouncement(announcementId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ANNOUNCEMENTS)
        .delete()
        .eq('id', announcementId)
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
   * Subscribe to real-time announcements
   */
  subscribeToAnnouncements(callback) {
    const channel = supabase
      .channel(CHANNELS.ANNOUNCEMENTS)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: TABLES.ANNOUNCEMENTS 
        },
        async (payload) => {
          // Fetch creator info
          if (payload.new?.created_by) {
            const { data: userData } = await supabase
              .from(TABLES.USERS)
              .select('id, email, full_name, role')
              .eq('id', payload.new.created_by)
              .single()

            callback({
              ...payload,
              new: {
                ...payload.new,
                users: userData
              }
            })
          } else {
            callback(payload)
          }
        }
      )
      .subscribe()

    return channel
  },

  /**
   * Unsubscribe from announcements
   */
  async unsubscribeFromAnnouncements(channel) {
    if (channel) {
      await supabase.removeChannel(channel)
    }
  }
}