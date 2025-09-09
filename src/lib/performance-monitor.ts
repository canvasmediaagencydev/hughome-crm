/**
 * Performance monitoring utilities for the authentication system
 * Tracks key metrics and provides insights for further optimization
 */

interface PerformanceMetric {
  operation: string
  duration: number
  timestamp: number
  metadata?: Record<string, any>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private readonly maxMetrics = 1000 // Prevent memory leaks

  /**
   * Start timing an operation
   */
  startTiming(operation: string) {
    const start = performance.now()
    return {
      end: (metadata?: Record<string, any>) => {
        const duration = performance.now() - start
        this.addMetric(operation, duration, metadata)
        return duration
      }
    }
  }

  /**
   * Add a performance metric
   */
  addMetric(operation: string, duration: number, metadata?: Record<string, any>) {
    // Prevent memory leaks by maintaining a rolling window
    if (this.metrics.length >= this.maxMetrics) {
      this.metrics.shift()
    }

    this.metrics.push({
      operation,
      duration,
      timestamp: Date.now(),
      metadata
    })

    // Log slow operations in development
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.warn(`🐌 Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`, metadata)
    }
  }

  /**
   * Get performance statistics for an operation
   */
  getStats(operation: string) {
    const operationMetrics = this.metrics.filter(m => m.operation === operation)
    
    if (operationMetrics.length === 0) {
      return null
    }

    const durations = operationMetrics.map(m => m.duration)
    const sum = durations.reduce((a, b) => a + b, 0)
    const avg = sum / durations.length
    const min = Math.min(...durations)
    const max = Math.max(...durations)
    
    // Calculate percentiles
    const sorted = durations.sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]

    return {
      operation,
      count: operationMetrics.length,
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      p50: Math.round(p50 * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      p99: Math.round(p99 * 100) / 100,
      lastRecorded: new Date(Math.max(...operationMetrics.map(m => m.timestamp))).toISOString()
    }
  }

  /**
   * Get all performance statistics
   */
  getAllStats() {
    const operations = [...new Set(this.metrics.map(m => m.operation))]
    return operations.map(op => this.getStats(op)).filter(Boolean)
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = []
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    return {
      metrics: this.metrics,
      summary: this.getAllStats(),
      exportTime: new Date().toISOString()
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Decorator for timing async functions
 */
export function timed(operation: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const timer = performanceMonitor.startTiming(`${operation}.${propertyKey}`)
      try {
        const result = await originalMethod.apply(this, args)
        timer.end({ success: true })
        return result
      } catch (error) {
        timer.end({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        throw error
      }
    }

    return descriptor
  }
}

/**
 * Utility function to time any operation
 */
export async function timeOperation<T>(
  operation: string, 
  fn: () => Promise<T>, 
  metadata?: Record<string, any>
): Promise<T> {
  const timer = performanceMonitor.startTiming(operation)
  try {
    const result = await fn()
    timer.end({ ...metadata, success: true })
    return result
  } catch (error) {
    timer.end({ 
      ...metadata, 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    throw error
  }
}

/**
 * Create a performance report for the authentication system
 */
export function createAuthPerformanceReport() {
  const authOps = [
    'auth.login.total',
    'auth.token.verify', 
    'auth.user.lookup',
    'auth.user.update',
    'auth.user.create',
    'database.connection',
    'cache.hit',
    'cache.miss'
  ]

  const report = {
    timestamp: new Date().toISOString(),
    operations: authOps.map(op => performanceMonitor.getStats(op)).filter(Boolean),
    recommendations: [] as string[]
  }

  // Generate performance recommendations
  report.operations.forEach(stat => {
    if (!stat) return
    if (stat.avg > 200) {
      report.recommendations.push(`⚠️ ${stat.operation} average time (${stat.avg}ms) is high - consider optimization`)
    }
    if (stat.p95 > 500) {
      report.recommendations.push(`🚨 ${stat.operation} 95th percentile (${stat.p95}ms) indicates performance issues`)
    }
    if (stat.max > 1000) {
      report.recommendations.push(`❗ ${stat.operation} max time (${stat.max}ms) suggests potential timeouts`)
    }
  })

  return report
}

// Export the performance monitor instance for direct use
export default performanceMonitor