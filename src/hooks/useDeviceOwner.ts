import { useState, useEffect, useCallback } from 'react'

const OWNER_KEY = 'device-owner'

export function useDeviceOwner() {
  const [ownerId, setOwnerIdState] = useState<string>(() => localStorage.getItem(OWNER_KEY) || '')

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === OWNER_KEY) setOwnerIdState(e.newValue || '')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setOwnerId = useCallback((id: string) => {
    localStorage.setItem(OWNER_KEY, id)
    setOwnerIdState(id)
  }, [])

  const clearOwner = useCallback(() => {
    localStorage.removeItem(OWNER_KEY)
    setOwnerIdState('')
  }, [])

  return { ownerId, setOwnerId, clearOwner }
}

// track which reminders have been acknowledged today
const ACK_PREFIX = 'reminder-ack-'

export function isReminderAcked(reminderId: string, dateStr: string): boolean {
  return localStorage.getItem(`${ACK_PREFIX}${dateStr}-${reminderId}`) === '1'
}

export function ackReminder(reminderId: string, dateStr: string) {
  localStorage.setItem(`${ACK_PREFIX}${dateStr}-${reminderId}`, '1')
}

// cleanup old acknowledgments (older than 7 days)
export function cleanupOldAcks() {
  const today = new Date()
  const cutoff = new Date(today)
  cutoff.setDate(today.getDate() - 7)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && key.startsWith(ACK_PREFIX)) {
      const datePart = key.substring(ACK_PREFIX.length, ACK_PREFIX.length + 10)
      if (datePart < cutoffStr) localStorage.removeItem(key)
    }
  }
}
