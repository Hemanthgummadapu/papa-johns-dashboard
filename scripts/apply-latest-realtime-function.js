// Script to apply the get_latest_realtime_data function migration
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('\n=== Applying get_latest_realtime_data function ===\n');
  
  // Read the migration SQL file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/017_get_latest_realtime_data.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log('SQL to execute:');
  console.log(sql);
  console.log('\n');
  
  // Execute the SQL using Supabase's RPC (we'll use a direct query)
  // Note: Supabase JS client doesn't support raw SQL directly, so we need to use the REST API
  // For now, let's use the admin client's ability to execute SQL via RPC
  
  try {
    // Use the REST API to execute raw SQL
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql })
    });
    
    if (!response.ok) {
      // If that doesn't work, try using pg directly
      console.log('⚠️  Direct REST API not available. Please run the SQL manually in Supabase SQL Editor.');
      console.log('\n📋 To apply this migration:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the SQL from: supabase/migrations/017_get_latest_realtime_data.sql');
      console.log('4. Run the SQL');
      return;
    }
    
    console.log('✅ Function created successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Please run the SQL manually in Supabase SQL Editor:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL from: supabase/migrations/017_get_latest_realtime_data.sql');
    console.log('4. Run the SQL');
  }
}

applyMigration().catch(console.error);

