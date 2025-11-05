/**
 * Shared utilities for onboarding status validation
 * Ensures consistent logic across client and server
 */

export interface OnboardingCheckData {
  role?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
}

/**
 * Checks if user has completed onboarding
 * Single source of truth for is_onboarded calculation
 *
 * @param userData - User profile data to check
 * @returns true if all required fields are filled, false otherwise
 */
export function isUserOnboarded(userData: OnboardingCheckData | null | undefined): boolean {
  if (!userData) {
    return false
  }

  // All required fields must be present and non-empty
  return !!(
    userData.role &&
    userData.first_name &&
    userData.last_name &&
    userData.phone
  )
}

/**
 * Gets list of missing onboarding fields
 * Useful for debugging and user feedback
 *
 * @param userData - User profile data to check
 * @returns Array of missing field names
 */
export function getMissingOnboardingFields(userData: OnboardingCheckData | null | undefined): string[] {
  if (!userData) {
    return ['role', 'first_name', 'last_name', 'phone']
  }

  const missingFields: string[] = []

  if (!userData.role) missingFields.push('role')
  if (!userData.first_name) missingFields.push('first_name')
  if (!userData.last_name) missingFields.push('last_name')
  if (!userData.phone) missingFields.push('phone')

  return missingFields
}
