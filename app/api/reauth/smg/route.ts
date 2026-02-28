import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('[reauth-smg] Opening Terminal to run SMG reauth...');
    
    const script = `
      tell application "Terminal"
        activate
        do script "cd /Users/hemanthgummadapu/papa-johns-dashboard && npm run smg:reauth"
      end tell
    `;
    
    exec(`osascript -e '${script}'`, (err) => {
      if (err) {
        console.error('[reauth-smg] osascript error:', err);
      } else {
        console.log('[reauth-smg] ✅ Terminal opened successfully');
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Terminal opened — complete MFA if prompted'
    });
  } catch (error: any) {
    console.error('[reauth-smg] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
