/**
 * Axios instance สำหรับ admin API calls
 * Automatically adds Authorization header from Supabase session
 */

import axios from 'axios'
import { createClient } from '@/lib/supabase-browser'

// สร้าง axios instance สำหรับ admin
export const axiosAdmin = axios.create()

// เพิ่ม interceptor เพื่อใส่ Authorization header อัตโนมัติ
axiosAdmin.interceptors.request.use(
  async (config) => {
    console.log('[axiosAdmin] Request interceptor started', config.url)
    const supabase = createClient()
    // ดึง session token จาก Supabase
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.access_token) {
      console.log('[axiosAdmin] Token found, attaching to header')
      config.headers.Authorization = `Bearer ${session.access_token}`
    } else {
      console.log('[axiosAdmin] No token found')
    }

    console.log('[axiosAdmin] Request interceptor finished')
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// เพิ่ม response interceptor สำหรับจัดการ 401/403 errors
axiosAdmin.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      // Use window.location to ensure full page reload and state clear
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  }
)
