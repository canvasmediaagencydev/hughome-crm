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

      // Test with a small endpoint or image
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache',
        signal: controller.signal,
      }).catch(() => {
        // Fallback to testing with a small image or CSS file
        return fetch('/favicon.ico', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: controller.signal,
        })
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
    console.log('🔄 Testing connection quality...')
    const quality = await testConnectionQuality()
    
    setConnectionQuality(quality)
    setIsOnline(quality !== 'offline')
    setIsSlowConnection(quality === 'slow')
    
    console.log(`📡 Connection quality: ${quality}`)
    return
  }, [testConnectionQuality])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network: Back online')
      setIsOnline(true)
      retryConnection()
    }

    const handleOffline = () => {
      console.log('📡 Network: Gone offline')
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