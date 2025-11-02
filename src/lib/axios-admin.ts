/**
 * Axios instance สำหรับ admin API calls
 * Automatically adds Authorization header from Supabase session
 */

import axios from 'axios'
import { supabaseAdmin } from '@/lib/supabase-admin'

// สร้าง axios instance สำหรับ admin
export const axiosAdmin = axios.create()

// เพิ่ม interceptor เพื่อใส่ Authorization header อัตโนมัติ
axiosAdmin.interceptors.request.use(
  async (config) => {
    // ดึง session token จาก Supabase
    const { data: { session } } = await supabaseAdmin.auth.getSession()

    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }

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
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  }
)
