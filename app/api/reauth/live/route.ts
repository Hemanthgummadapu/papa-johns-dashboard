import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('[reauth-live] Opening Terminal to run live data scrape...');
    
    const script = `
      tell application "Terminal"
        activate
        do script "cd /Users/hemanthgummadapu/papa-johns-dashboard && npm run live:reauth"
      end tell
    `;
    
    exec(`osascript -e '${script}'`, (err) => {
      if (err) {
        console.error('[reauth-live] osascript error:', err);
      } else {
        console.log('[reauth-live] ✅ Terminal opened successfully');
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Terminal opened — complete MFA if prompted'
    });
  } catch (error: any) {
    console.error('[reauth-live] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
