-- Create point_settings table for configurable point exchange rates
CREATE TABLE point_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value DECIMAL(10,2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default point exchange rate (100 baht = 1 point)
INSERT INTO point_settings (setting_key, setting_value, description, created_by)
VALUES (
  'baht_per_point',
  100.00,
  'Amount in Thai Baht required to earn 1 point',
  (SELECT id FROM auth.users WHERE email LIKE '%admin%' LIMIT 1)
);

-- Create index for faster lookups
CREATE INDEX idx_point_settings_key ON point_settings(setting_key);
CREATE INDEX idx_point_settings_active ON point_settings(is_active);

-- Enable RLS
ALTER TABLE point_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read/write point settings
CREATE POLICY "Only admins can manage point settings" ON point_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Policy: Everyone can read active settings
CREATE POLICY "Everyone can read active point settings" ON point_settings
  FOR SELECT USING (is_active = true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_point_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_point_settings_updated_at
  BEFORE UPDATE ON point_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_point_settings_updated_at();