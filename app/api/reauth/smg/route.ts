import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const script = `
      tell application "Terminal"
        activate
        do script "cd /Users/hemanthgummadapu/papa-johns-dashboard && npm run smg:reauth"
      end tell
    `;
    exec(`osascript -e '${script}'`, () => {});
    return NextResponse.json({
      success: true,
      message: 'Terminal opened — complete MFA if prompted'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
