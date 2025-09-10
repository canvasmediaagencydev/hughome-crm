'use client'

import { useAuthContext } from './AuthProvider'

interface ConnectionStatusProps {
  showRetryButton?: boolean
}

export function ConnectionStatus({ showRetryButton = true }: ConnectionStatusProps) {
  const { isOnline, connectionQuality, retryConnection, error, login } = useAuthContext()

  // Only show if there's a connection issue
  if (isOnline && connectionQuality === 'fast' && !error) {
    return null
  }

  const getStatusText = () => {
    if (!isOnline || connectionQuality === 'offline') {
      return 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต'
    }
    if (connectionQuality === 'slow') {
      return 'การเชื่อมต่ออินเทอร์เน็ตช้า'
    }
    if (error) {
      return 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
    }
    return 'ตรวจสอบการเชื่อมต่อ...'
  }

  const getStatusColor = () => {
    if (!isOnline || connectionQuality === 'offline') {
      return 'bg-red-50 border-red-200 text-red-800'
    }
    if (connectionQuality === 'slow' || error) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    }
    return 'bg-blue-50 border-blue-200 text-blue-800'
  }

  const handleRetry = async () => {
    try {
      await retryConnection()
      
      // If network is back and there's an auth error, try to login again
      if (isOnline && error && error.includes('Login')) {
        await login()
      }
    } catch (err) {
      console.warn('Retry failed:', err)
    }
  }

  return (
    <div className={`rounded-lg border p-3 mb-4 ${getStatusColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-current opacity-60"></div>
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
        
        {showRetryButton && (
          <button
            onClick={handleRetry}
            className="text-sm px-3 py-1 rounded bg-current bg-opacity-10 hover:bg-opacity-20 transition-colors"
          >
            ลองใหม่
          </button>
        )}
      </div>
      
      {error && (
        <p className="text-xs mt-1 opacity-75">
          {error}
        </p>
      )}
    </div>
  )
}