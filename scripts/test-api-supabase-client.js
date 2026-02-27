// Test if the Supabase client works the same way as in the API route
import { getSupabaseAdminClient } from '../lib/db.js';

async function test() {
  try {
    console.log('Testing getSupabaseAdminClient...\n');
    
    const supabaseAdmin = getSupabaseAdminClient();
    console.log('✅ Client created successfully');
    
    const { data, error } = await supabaseAdmin
      .from('realtime_summary')
      .select('*')
      .order('scraped_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`✅ Query returned ${data?.length || 0} records`);
    if (data && data.length > 0) {
      console.log(`   First record: store ${data[0].store_number}, scraped_at = ${data[0].scraped_at}`);
    }
  } catch (error) {
    console.error('❌ Exception:', error);
  }
}

test().catch(console.error);

