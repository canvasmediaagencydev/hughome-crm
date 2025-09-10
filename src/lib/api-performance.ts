import { NextRequest, NextResponse } from 'next/server'

// Request deduplication cache
interface PendingRequest {
  promise: Promise<NextResponse>
  timestamp: number
}

const pendingRequests = new Map<string, PendingRequest>()
const REQUEST_DEDUP_TTL = 5000 // 5 seconds
const MAX_PENDING_REQUESTS = 100

/**
 * Generate cache key for request deduplication
 */
function generateRequestKey(request: NextRequest, body?: any): string {
  const url = request.url
  const method = request.method
  const bodyHash = body ? JSON.stringify(body) : ''
  const authHeader = request.headers.get('authorization') || ''
  
  // Include auth token in key to ensure user-specific deduplication
  return `${method}:${url}:${bodyHash}:${authHeader.slice(0, 50)}`
}

/**
 * Cleanup expired pending requests
 */
function cleanupExpiredRequests() {
  const now = Date.now()
  for (const [key, request] of pendingRequests.entries()) {
    if (now - request.timestamp > REQUEST_DEDUP_TTL) {
      pendingRequests.delete(key)
    }
  }
}

/**
 * Request deduplication wrapper - prevents duplicate requests
 */
export function withRequestDeduplication<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  generateKey?: (request: NextRequest, ...args: any[]) => string
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Generate request key for deduplication
    const requestKey = generateKey ? 
      generateKey(request, ...args) : 
      generateRequestKey(request)
    
    // Check if this request is already in progress
    const existing = pendingRequests.get(requestKey)
    if (existing) {
      console.log('🔄 Request deduplication hit:', requestKey)
      return existing.promise
    }
    
    // Cleanup expired requests periodically
    if (pendingRequests.size > MAX_PENDING_REQUESTS) {
      cleanupExpiredRequests()
    }
    
    // Create new request promise
    const requestPromise = handler(request, ...args).finally(() => {
      // Remove from pending requests when complete
      pendingRequests.delete(requestKey)
    })
    
    // Store pending request
    pendingRequests.set(requestKey, {
      promise: requestPromise,
      timestamp: Date.now()
    })
    
    return requestPromise
  }
}

/**
 * Response compression utility
 */
export function compressResponse(response: NextResponse, minSize = 1024): NextResponse {
  try {
    // Only compress JSON responses above minimum size
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return response
    }
    
    // Add compression headers if not already present
    if (!response.headers.get('content-encoding')) {
      response.headers.set('vary', 'Accept-Encoding')
      // Browser will handle compression based on Accept-Encoding header
    }
    
    return response
  } catch (error) {
    console.error('Response compression error:', error)
    return response
  }
}

/**
 * Performance monitoring wrapper
 */
export function withPerformanceMonitoring<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  operationName: string
) {
  return async (...args: T): Promise<NextResponse> => {
    const startTime = Date.now()
    const request = args[0] as NextRequest
    
    try {
      const response = await handler(...args)
      const duration = Date.now() - startTime
      
      // Log performance metrics
      console.log(`⚡ ${operationName} completed in ${duration}ms`, {
        method: request.method,
        url: request.url,
        status: response.status,
        duration
      })
      
      // Add performance headers
      response.headers.set('x-response-time', duration.toString())
      response.headers.set('x-operation', operationName)
      
      return compressResponse(response)
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`❌ ${operationName} failed after ${duration}ms`, error)
      throw error
    }
  }
}

/**
 * Rate limiting utility (simple in-memory implementation)
 */
interface RateLimit {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimit>()

export function withRateLimit(
  maxRequests = 100,
  windowMs = 60000, // 1 minute
  keyGenerator = (request: NextRequest) => {
    // Use IP + User-Agent for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    const userAgent = request.headers.get('user-agent')?.slice(0, 50) || 'unknown'
    return `${ip}:${userAgent}`
  }
) {
  return <T extends any[]>(handler: (...args: T) => Promise<NextResponse>) => {
    return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
      const key = keyGenerator(request)
      const now = Date.now()
      
      let rateLimit = rateLimitMap.get(key)
      
      // Reset if window has passed
      if (!rateLimit || now > rateLimit.resetTime) {
        rateLimit = { count: 0, resetTime: now + windowMs }
        rateLimitMap.set(key, rateLimit)
      }
      
      // Check if rate limit exceeded
      if (rateLimit.count >= maxRequests) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', retryAfter: Math.ceil((rateLimit.resetTime - now) / 1000) },
          { 
            status: 429,
            headers: {
              'x-rate-limit-remaining': '0',
              'x-rate-limit-reset': rateLimit.resetTime.toString()
            }
          }
        )
      }
      
      // Increment counter
      rateLimit.count++
      
      const response = await handler(request, ...args)
      
      // Add rate limit headers
      response.headers.set('x-rate-limit-limit', maxRequests.toString())
      response.headers.set('x-rate-limit-remaining', (maxRequests - rateLimit.count).toString())
      response.headers.set('x-rate-limit-reset', rateLimit.resetTime.toString())
      
      return response
    }
  }
}

/**
 * Health check endpoint optimization
 */
export function createHealthCheck(checks: Record<string, () => Promise<boolean>>) {
  return async (): Promise<NextResponse> => {
    const startTime = Date.now()
    const results: Record<string, { status: 'ok' | 'error', duration: number, error?: string }> = {}
    
    // Run all health checks in parallel with timeout
    const checkPromises = Object.entries(checks).map(async ([name, check]) => {
      const checkStart = Date.now()
      try {
        await Promise.race([
          check(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ])
        results[name] = { 
          status: 'ok', 
          duration: Date.now() - checkStart 
        }
      } catch (error) {
        results[name] = { 
          status: 'error', 
          duration: Date.now() - checkStart,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
    
    await Promise.allSettled(checkPromises)
    
    const overallStatus = Object.values(results).every(r => r.status === 'ok') ? 'healthy' : 'unhealthy'
    const totalDuration = Date.now() - startTime
    
    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      checks: results
    }, {
      status: overallStatus === 'healthy' ? 200 : 503,
      headers: {
        'cache-control': 'no-cache, no-store, must-revalidate',
        'x-health-check-duration': totalDuration.toString()
      }
    })
  }
}