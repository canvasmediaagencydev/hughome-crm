import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getCacheStats } from '@/lib/supabase-server'

// Database connectivity check
async function checkDatabase(): Promise<boolean> {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
    
    return !error
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

// Cache performance check
async function checkCache(): Promise<boolean> {
  try {
    const stats = getCacheStats()
    // Consider cache healthy if it has reasonable size and recent entries
    return stats.size >= 0 && stats.size < stats.maxSize
  } catch (error) {
    console.error('Cache health check failed:', error)
    return false
  }
}

// LINE API connectivity check
async function checkLineAPI(): Promise<boolean> {
  try {
    const response = await fetch('https://api.line.me/oauth2/v2.1/certs', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch (error) {
    console.error('LINE API health check failed:', error)
    return false
  }
}

// Memory usage check
async function checkMemory(): Promise<boolean> {
  try {
    const used = process.memoryUsage()
    const heapUsedMB = used.heapUsed / 1024 / 1024
    const heapTotalMB = used.heapTotal / 1024 / 1024
    
    // Consider healthy if heap usage is less than 80% of total
    return (heapUsedMB / heapTotalMB) < 0.8
  } catch (error) {
    console.error('Memory health check failed:', error)
    return false
  }
}

// Export the health check handler
export async function GET(): Promise<NextResponse> {
  const startTime = Date.now()
  const results: Record<string, { status: 'ok' | 'error', duration: number, error?: string }> = {}
  
  // Run all health checks in parallel with timeout
  const checks = { database: checkDatabase, cache: checkCache, lineAPI: checkLineAPI, memory: checkMemory }
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

// Also provide detailed performance metrics
export async function POST(): Promise<NextResponse> {
  try {
    const memoryUsage = process.memoryUsage()
    const cacheStats = getCacheStats()
    
    // Test database query performance
    const dbStart = Date.now()
    const supabase = createServerSupabaseClient()
    await supabase.from('user_profiles').select('count').limit(1)
    const dbDuration = Date.now() - dbStart
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      performance: {
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
          external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100, // MB
          rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100 // MB
        },
        cache: {
          size: cacheStats.size,
          maxSize: cacheStats.maxSize,
          utilization: Math.round((cacheStats.size / cacheStats.maxSize) * 100) + '%',
          entries: cacheStats.entries.length > 5 ? 
            cacheStats.entries.slice(0, 5).map(entry => ({
              lineUserId: entry.lineUserId.slice(0, 8) + '...',
              cached: entry.cached,
              ttl: entry.ttl
            })) : cacheStats.entries
        },
        database: {
          queryDuration: dbDuration,
          status: dbDuration < 200 ? 'fast' : dbDuration < 500 ? 'moderate' : 'slow'
        },
        uptime: process.uptime()
      }
    }, {
      headers: {
        'cache-control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    console.error('Performance metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to generate performance metrics' },
      { status: 500 }
    )
  }
}