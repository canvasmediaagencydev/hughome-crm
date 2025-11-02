require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestAdmins() {
  console.log('📋 Creating test admin users...\n');

  // Test 1: Receipt Manager
  console.log('1. Creating Receipt Manager...');
  const { data: receiptAdmin, error: r1 } = await supabase.auth.admin.createUser({
    email: 'receipt@test.com',
    password: 'test1234',
    email_confirm: true
  });

  if (r1) {
    console.log('❌ Error:', r1.message);
  } else {
    console.log('✅ Created auth user:', receiptAdmin.user.id);

    // Create admin_users record
    const { data: au1, error: e1 } = await supabase
      .from('admin_users')
      .insert({
        auth_user_id: receiptAdmin.user.id,
        email: 'receipt@test.com',
        full_name: 'Receipt Manager Test'
      })
      .select()
      .single();

    if (e1) {
      console.log('❌ Error creating admin_users:', e1.message);
    } else {
      console.log('✅ Created admin_users record');

      // Get receipt_manager role
      const { data: role } = await supabase
        .from('admin_roles')
        .select('id')
        .eq('name', 'receipt_manager')
        .single();

      // Assign role
      await supabase
        .from('admin_user_roles')
        .insert({
          admin_user_id: au1.id,
          role_id: role.id
        });

      console.log('✅ Assigned receipt_manager role\n');
    }
  }

  // Test 2: Customer Support
  console.log('2. Creating Customer Support...');
  const { data: supportAdmin, error: r2 } = await supabase.auth.admin.createUser({
    email: 'support@test.com',
    password: 'test1234',
    email_confirm: true
  });

  if (r2) {
    console.log('❌ Error:', r2.message);
  } else {
    console.log('✅ Created auth user:', supportAdmin.user.id);

    const { data: au2, error: e2 } = await supabase
      .from('admin_users')
      .insert({
        auth_user_id: supportAdmin.user.id,
        email: 'support@test.com',
        full_name: 'Customer Support Test'
      })
      .select()
      .single();

    if (e2) {
      console.log('❌ Error creating admin_users:', e2.message);
    } else {
      console.log('✅ Created admin_users record');

      const { data: role } = await supabase
        .from('admin_roles')
        .select('id')
        .eq('name', 'customer_support')
        .single();

      await supabase
        .from('admin_user_roles')
        .insert({
          admin_user_id: au2.id,
          role_id: role.id
        });

      console.log('✅ Assigned customer_support role\n');
    }
  }

  // Test 3: Reward Manager
  console.log('3. Creating Reward Manager...');
  const { data: rewardAdmin, error: r3 } = await supabase.auth.admin.createUser({
    email: 'reward@test.com',
    password: 'test1234',
    email_confirm: true
  });

  if (r3) {
    console.log('❌ Error:', r3.message);
  } else {
    console.log('✅ Created auth user:', rewardAdmin.user.id);

    const { data: au3, error: e3 } = await supabase
      .from('admin_users')
      .insert({
        auth_user_id: rewardAdmin.user.id,
        email: 'reward@test.com',
        full_name: 'Reward Manager Test'
      })
      .select()
      .single();

    if (e3) {
      console.log('❌ Error creating admin_users:', e3.message);
    } else {
      console.log('✅ Created admin_users record');

      const { data: role } = await supabase
        .from('admin_roles')
        .select('id')
        .eq('name', 'reward_manager')
        .single();

      await supabase
        .from('admin_user_roles')
        .insert({
          admin_user_id: au3.id,
          role_id: role.id
        });

      console.log('✅ Assigned reward_manager role\n');
    }
  }

  console.log('🎉 All test admins created!');
  console.log('\n📝 Test Accounts:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✉️  receipt@test.com / test1234');
  console.log('   Role: Receipt Manager');
  console.log('   Permissions: receipts.*, users.view');
  console.log('');
  console.log('✉️  support@test.com / test1234');
  console.log('   Role: Customer Support');
  console.log('   Permissions: users.*, redemptions.*');
  console.log('');
  console.log('✉️  reward@test.com / test1234');
  console.log('   Role: Reward Manager');
  console.log('   Permissions: rewards.*');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

createTestAdmins().catch(console.error);
