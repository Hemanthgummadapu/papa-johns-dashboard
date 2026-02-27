// Test the fixed API endpoint
const response = await fetch('http://localhost:3000/api/live-data');
const data = await response.json();

console.log('\n=== Testing Fixed API ===\n');
console.log(`Success: ${data.success}`);
console.log(`Data count: ${data.data?.length || 0}`);
console.log(`Last Scraped: ${data.lastScraped || 'None'}\n`);

if (data.data && data.data.length > 0) {
  console.log('📊 All stores:');
  data.data.forEach(store => {
    console.log(`  Store ${store.store_number}:`);
    console.log(`    scraped_at: ${store.scraped_at}`);
    console.log(`    sales: $${store.total_net_sales}`);
    console.log(`    labor: ${store.labor_pct}%`);
    console.log('');
  });
  
  const store2481 = data.data.find(s => s.store_number === '2481');
  if (store2481) {
    console.log('✅ Store 2481 found:');
    console.log(`   scraped_at: ${store2481.scraped_at}`);
    console.log(`   Expected: 2026-02-27T01:31:22 (5:31 PM)`);
    console.log(`   Match: ${store2481.scraped_at.includes('01:31:22') ? '✅ YES' : '❌ NO'}`);
  } else {
    console.log('❌ Store 2481 not found');
  }
  
  console.log(`\n✅ Last Scraped (most recent): ${data.lastScraped}`);
} else {
  console.log('⚠️  No data returned');
}

