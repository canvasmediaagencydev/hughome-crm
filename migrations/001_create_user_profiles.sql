-- Migration: Create user_profiles table with RLS policies
-- This migration creates the user_profiles table and sets up Row Level Security policies
-- for secure access control based on LINE user authentication

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_user_id TEXT NOT NULL UNIQUE,
    role TEXT CHECK (role IN ('contractor', 'homeowner')),
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    display_name TEXT,
    picture_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on line_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_line_user_id ON public.user_profiles(line_user_id);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Policy 1: Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (
        line_user_id = current_setting('app.current_user_line_id', true)
    );

-- Policy 2: Users can insert their own profile (for registration)
CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (
        line_user_id = current_setting('app.current_user_line_id', true)
    );

-- Policy 3: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (
        line_user_id = current_setting('app.current_user_line_id', true)
    ) WITH CHECK (
        line_user_id = current_setting('app.current_user_line_id', true)
    );

-- Policy 4: Service role can do everything (for server-side operations)
CREATE POLICY "Service role full access" ON public.user_profiles
    FOR ALL USING (
        current_user = 'service_role' OR 
        current_setting('role') = 'service_role'
    );

-- Grant necessary permissions
GRANT ALL ON public.user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.user_profiles IS 'User profiles linked to LINE user accounts';
COMMENT ON COLUMN public.user_profiles.id IS 'UUID primary key for user profile';
COMMENT ON COLUMN public.user_profiles.line_user_id IS 'LINE user ID from LINE Login';
COMMENT ON COLUMN public.user_profiles.role IS 'User role: contractor or homeowner';
COMMENT ON COLUMN public.user_profiles.first_name IS 'User first name from onboarding';
COMMENT ON COLUMN public.user_profiles.last_name IS 'User last name from onboarding';
COMMENT ON COLUMN public.user_profiles.phone IS 'User phone number from onboarding';
COMMENT ON COLUMN public.user_profiles.display_name IS 'Display name from LINE profile';
COMMENT ON COLUMN public.user_profiles.picture_url IS 'Profile picture URL from LINE';