/**
 * Script: สร้าง test admin user
 *
 * Run: node scripts/create-test-admin.js
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestAdmin() {
  console.log('🔧 Creating test admin user...\n')

  const email = 'test@admin.com'
  const password = 'Test1234!'
  const fullName = 'Test Administrator'

  try {
    // 1. สร้าง auth user
    console.log(`📧 Creating auth user: ${email}`)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    })

    if (authError) {
      console.error('❌ Error creating auth user:', authError.message)
      process.exit(1)
    }

    console.log('✅ Auth user created:', authData.user.id)

    // 2. สร้าง admin_users record
    console.log('\n👤 Creating admin_users record...')
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .insert({
        auth_user_id: authData.user.id,
        email: email,
        full_name: fullName,
        is_active: true,
        last_login_at: new Date().toISOString()
      })
      .select()
      .single()

    if (adminError) {
      console.error('❌ Error creating admin_users:', adminError.message)
      process.exit(1)
    }

    console.log('✅ Admin user created:', adminUser.id)

    // 3. มอบหมาย super_admin role
    console.log('\n🔑 Assigning super_admin role...')

    // หา super_admin role
    const { data: superAdminRole } = await supabase
      .from('admin_roles')
      .select('id')
      .eq('name', 'super_admin')
      .single()

    if (!superAdminRole) {
      console.error('❌ super_admin role not found!')
      process.exit(1)
    }

    // มอบหมาย role
    const { error: roleError } = await supabase
      .from('admin_user_roles')
      .insert({
        admin_user_id: adminUser.id,
        role_id: superAdminRole.id,
        assigned_by: adminUser.id,
        assigned_at: new Date().toISOString()
      })

    if (roleError) {
      console.error('❌ Error assigning role:', roleError.message)
      process.exit(1)
    }

    console.log('✅ Super Admin role assigned')

    // 4. สรุปผล
    console.log('\n' + '='.repeat(50))
    console.log('🎉 Test Admin Created Successfully!')
    console.log('='.repeat(50))
    console.log(`📧 Email:    ${email}`)
    console.log(`🔒 Password: ${password}`)
    console.log(`👤 Name:     ${fullName}`)
    console.log(`🔑 Role:     Super Admin`)
    console.log('='.repeat(50))
    console.log('\n✨ You can now login at /admin/login\n')

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    process.exit(1)
  }
}

createTestAdmin()
