export interface User {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
  role: 'contractor' | 'homeowner' | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  is_onboarded: boolean
}

export interface LoginResponse {
  success: boolean
  user?: User
  error?: string
}

export interface UpdateProfileResponse {
  success: boolean
  user?: User
  error?: string
}

export interface OnboardingFormData {
  role: 'contractor' | 'homeowner'
  first_name: string
  last_name: string
  phone: string
}