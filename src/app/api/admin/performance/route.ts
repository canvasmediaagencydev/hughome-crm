import { NextRequest, NextResponse } from 'next/server'
import { createAuthPerformanceReport, performanceMonitor } from '@/lib/performance-monitor'
import { getCacheStats } from '@/lib/supabase-server'

interface PerformanceResponse {
  success: boolean
  data?: {
    authMetrics: any
    cacheStats: any
    systemHealth: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      issues: string[]
    }
  }
  error?: string
}

export async function GET(request: NextRequest): Promise<NextResponse<PerformanceResponse>> {
  try {
    // Check if this is an admin request (in a real app, you'd verify admin authentication)
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (action === 'report') {
      // Generate comprehensive performance report
      const authReport = createAuthPerformanceReport()
      const cacheStats = getCacheStats()
      
      // Analyze system health
      const systemHealth = analyzeSystemHealth(authReport)
      
      return NextResponse.json({
        success: true,
        data: {
          authMetrics: authReport,
          cacheStats,
          systemHealth
        }
      })
    } else if (action === 'clear') {
      // Clear performance metrics
      performanceMonitor.clear()
      
      return NextResponse.json({
        success: true,
        data: {
          message: 'Performance metrics cleared',
          authMetrics: createAuthPerformanceReport(),
          cacheStats: getCacheStats(),
          systemHealth: {
            status: 'healthy' as const,
            issues: []
          }
        }
      })
    } else {
      // Default: return current metrics
      const authReport = createAuthPerformanceReport()
      const cacheStats = getCacheStats()
      const systemHealth = analyzeSystemHealth(authReport)
      
      return NextResponse.json({
        success: true,
        data: {
          authMetrics: authReport,
          cacheStats,
          systemHealth
        }
      })
    }
  } catch (error) {
    console.error('Performance monitoring error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Performance monitoring failed' 
      },
      { status: 500 }
    )
  }
}

/**
 * Analyze system health based on performance metrics
 */
function analyzeSystemHealth(authReport: any) {
  const issues: string[] = []
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  
  // Check if we have any metrics
  if (authReport.operations.length === 0) {
    return {
      status: 'healthy' as const,
      issues: ['No performance data available yet']
    }
  }
  
  // Analyze each operation
  authReport.operations.forEach((op: any) => {
    // Check average response time
    if (op.avg > 200) {
      issues.push(`${op.operation} average response time (${op.avg}ms) exceeds 200ms target`)
      status = status === 'healthy' ? 'degraded' : status
    }
    
    if (op.avg > 500) {
      issues.push(`${op.operation} average response time (${op.avg}ms) critically high`)
      status = 'unhealthy'
    }
    
    // Check 95th percentile
    if (op.p95 > 800) {
      issues.push(`${op.operation} 95th percentile (${op.p95}ms) indicates performance issues`)
      status = status === 'healthy' ? 'degraded' : status
    }
    
    if (op.p95 > 1500) {
      issues.push(`${op.operation} 95th percentile (${op.p95}ms) critically high`)
      status = 'unhealthy'
    }
    
    // Check maximum response time
    if (op.max > 2000) {
      issues.push(`${op.operation} maximum response time (${op.max}ms) suggests timeout risks`)
      status = status === 'healthy' ? 'degraded' : status
    }
  })
  
  // Special checks for authentication flow
  const authLoginTotal = authReport.operations.find((op: any) => op.operation === 'auth.login.total')
  if (authLoginTotal) {
    if (authLoginTotal.avg > 150) {
      issues.push(`Total authentication time (${authLoginTotal.avg}ms) exceeds 150ms optimization target`)
      status = status === 'healthy' ? 'degraded' : status
    }
    
    if (authLoginTotal.avg < 100) {
      // This is good - we've achieved our optimization goal
    }
  }
  
  // If no issues found and we have data, system is healthy
  if (issues.length === 0 && authReport.operations.length > 0) {
    issues.push('All performance metrics within acceptable ranges')
  }
  
  return {
    status,
    issues
  }
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  )
}