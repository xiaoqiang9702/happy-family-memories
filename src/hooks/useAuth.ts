import { useState, useCallback } from 'react'
import tripsData from '../data/trips.json'

const STORAGE_KEY = 'family-auth'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  const login = useCallback(async (password: string): Promise<boolean> => {
    // try API first (uses latest password on GitHub), fall back to static
    try {
      const resp = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (resp.ok) {
        localStorage.setItem(STORAGE_KEY, 'true')
        setIsAuthenticated(true)
        return true
      }
      // API responded with error (401 = wrong password)
      if (resp.status === 401) return false
    } catch {
      // API unavailable, fall through to static check
    }

    if (password === tripsData.password) {
      localStorage.setItem(STORAGE_KEY, 'true')
      setIsAuthenticated(true)
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setIsAuthenticated(false)
  }, [])

  return { isAuthenticated, login, logout }
}
