import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST() {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'live-scrape-cron.sh');
    
    console.log('[scrape-live] Starting live data scrape...');
    
    // Run the script with a 3-minute timeout
    const timeout = 3 * 60 * 1000; // 3 minutes in milliseconds
    
    try {
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Scrape timed out after 3 minutes')), timeout);
      });
      
      // Run the script
      const execPromise = execAsync(`bash "${scriptPath}"`, {
        cwd: process.cwd(),
      });
      
      // Race between execution and timeout
      await Promise.race([execPromise, timeoutPromise]);
      
      console.log('[scrape-live] ✅ Live data scrape completed successfully');
      
      return NextResponse.json({
        success: true,
        message: 'Live data scrape completed successfully'
      });
    } catch (error: any) {
      if (error.message?.includes('timeout')) {
        console.error('[scrape-live] ❌ Scrape timed out after 3 minutes');
        return NextResponse.json(
          { success: false, error: 'Scrape timed out after 3 minutes' },
          { status: 408 }
        );
      }
      
      console.error('[scrape-live] ❌ Scrape failed:', error.message);
      return NextResponse.json(
        { success: false, error: error.message || 'Scrape failed' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[scrape-live] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

