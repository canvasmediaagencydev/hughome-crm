import { NextRequest, NextResponse } from 'next/server'
import { verifyLineIdToken } from '@/lib/line-auth'
import { createServerSupabaseClient, getUserProfileOptimized } from '@/lib/supabase-server'

// Define route patterns
const PUBLIC_ROUTES = [
  '/',
  '/api/health',
  '/api/liff/login',
  '/_next',
  '/favicon.ico',
  '/manifest.json'
]

const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile',
  '/receipts',
  '/rewards',
  '/admin'
]

const AUTH_REQUIRED_ROUTES = [
  '/onboarding'
]

/**
 * Check if route matches any pattern in the array
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => {
    if (route.endsWith('/_next')) {
      return pathname.startsWith('/_next')
    }
    if (route.startsWith('/api/')) {
      return pathname === route || pathname.startsWith(route + '/')
    }
    return pathname === route || pathname.startsWith(route + '/')
  })
}

/**
 * Get user authentication status from cookie or session
 */
async function getUserAuthStatus(request: NextRequest) {
  try {
    // Check for auth token in cookies or headers
    const authCookie = request.cookies.get('hughome_auth')?.value
    const authHeader = request.headers.get('authorization')
    
    // For API routes, check authorization header
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.replace('Bearer ', '')
      try {
        const tokenPayload = await verifyLineIdToken(idToken)
        const userProfile = await getUserProfileOptimized(tokenPayload.sub)
        
        return {
          isAuthenticated: true,
          isOnboarded: !!(userProfile?.role && userProfile?.first_name && userProfile?.last_name && userProfile?.phone),
          userProfile,
          lineUserId: tokenPayload.sub
        }
      } catch (error) {
        console.warn('Token verification failed in middleware:', error)
        return { isAuthenticated: false, isOnboarded: false }
      }
    }

    // For page routes, check session cookie
    if (authCookie) {
      try {
        const authData = JSON.parse(authCookie)
        // Use optimized cached database fetch for performance
        const userProfile = await getUserProfileOptimized(authData.lineUserId)
        
        if (!userProfile) {
          console.warn('User profile not found in middleware:', authData.lineUserId)
          return { isAuthenticated: false, isOnboarded: false }
        }
        
        const isOnboarded = !!(userProfile?.role && userProfile?.first_name && userProfile?.last_name && userProfile?.phone)
        
        
        return {
          isAuthenticated: true,
          isOnboarded,
          userProfile,
          lineUserId: authData.lineUserId
        }
      } catch (error) {
        console.warn('Cookie parsing failed in middleware:', error)
      }
    }

    return { isAuthenticated: false, isOnboarded: false }
  } catch (error) {
    console.error('Auth status check failed:', error)
    return { isAuthenticated: false, isOnboarded: false }
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/images/') ||
    pathname.includes('.js.map') || // Skip source maps
    pathname.includes('installHook') || // Skip React DevTools
    pathname.includes('.') // Skip files with extensions
  ) {
    return NextResponse.next()
  }

  // Skip middleware for desktop development (faster for dev)
  const userAgent = request.headers.get('user-agent') || ''
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent)
  
  if (!isMobile && (pathname === '/' || pathname === '/dashboard' || pathname === '/onboarding')) {
    return NextResponse.next()
  }

  // Allow public routes
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next()
  }

  // Get user authentication status
  const authStatus = await getUserAuthStatus(request)

  // Handle protected routes
  if (matchesRoute(pathname, PROTECTED_ROUTES)) {
    if (!authStatus.isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    if (!authStatus.isOnboarded) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
    
    // Add user info to headers for the page
    const response = NextResponse.next()
    response.headers.set('x-user-id', authStatus.userProfile?.id || '')
    response.headers.set('x-line-user-id', authStatus.lineUserId || '')
    return response
  }

  // Handle auth-required routes (like onboarding)
  if (matchesRoute(pathname, AUTH_REQUIRED_ROUTES)) {
    if (!authStatus.isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    // If user is already onboarded, redirect to dashboard
    if (pathname === '/onboarding' && authStatus.isOnboarded) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    const response = NextResponse.next()
    response.headers.set('x-user-id', authStatus.userProfile?.id || '')
    response.headers.set('x-line-user-id', authStatus.lineUserId || '')
    return response
  }

  // Handle admin routes
  if (pathname.startsWith('/admin')) {
    if (!authStatus.isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    if (!authStatus.userProfile?.is_admin) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    const response = NextResponse.next()
    response.headers.set('x-user-id', authStatus.userProfile.id)
    response.headers.set('x-line-user-id', authStatus.lineUserId || '')
    response.headers.set('x-is-admin', 'true')
    return response
  }

  // Default: allow the request
  return NextResponse.next()
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (public/*)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}