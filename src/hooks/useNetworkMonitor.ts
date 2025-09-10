'use client'

import { useState, useEffect, useCallback } from 'react'

interface NetworkMonitorReturn {
  isOnline: boolean
  isSlowConnection: boolean
  retryConnection: () => Promise<void>
  connectionQuality: 'fast' | 'slow' | 'offline'
}

export function useNetworkMonitor(): NetworkMonitorReturn {
  const [isOnline, setIsOnline] = useState(true)
  const [isSlowConnection, setIsSlowConnection] = useState(false)
  const [connectionQuality, setConnectionQuality] = useState<'fast' | 'slow' | 'offline'>('fast')

  // Test connection speed and quality
  const testConnectionQuality = useCallback(async (): Promise<'fast' | 'slow' | 'offline'> => {
    try {
      const startTime = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      // Test with favicon - faster and no server processing
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const duration = Date.now() - startTime

      if (response.ok) {
        if (duration < 2000) {
          return 'fast'
        } else if (duration < 8000) {
          return 'slow'
        } else {
          return 'slow'
        }
      } else {
        return 'offline'
      }
    } catch (error) {
      console.warn('Connection test failed:', error)
      return 'offline'
    }
  }, [])

  // Retry connection function
  const retryConnection = useCallback(async () => {
    const quality = await testConnectionQuality()
    
    setConnectionQuality(quality)
    setIsOnline(quality !== 'offline')
    setIsSlowConnection(quality === 'slow')
    return
  }, [testConnectionQuality])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      retryConnection()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setConnectionQuality('offline')
    }

    // Set initial state
    setIsOnline(navigator.onLine)

    // Add event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial connection quality test
    if (navigator.onLine) {
      retryConnection()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [retryConnection])

  // Periodic connection quality check (disabled - only manual checks)
  // useEffect(() => {
  //   if (!isOnline) return

  //   const interval = setInterval(() => {
  //     retryConnection()
  //   }, 30000) // Check every 30 seconds

  //   return () => clearInterval(interval)
  // }, [isOnline, retryConnection])

  return {
    isOnline,
    isSlowConnection,
    retryConnection,
    connectionQuality,
  }
}