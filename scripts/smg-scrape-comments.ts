import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SMG_SESSION_FILE = './smg-session.json';

// Generate comment_id using base64 encoding of store_id + first 80 chars of comment_text only
function generateCommentId(storeId: string, commentText: string): string {
  const text = `${storeId}-${commentText.slice(0, 80)}`;
  return Buffer.from(text).toString('base64').slice(0, 64);
}

async function scrapeComments() {
  // Check if session file exists
  if (!existsSync(SMG_SESSION_FILE)) {
    throw new Error('smg-session.json not found. Please run smg-auto-session.ts first.');
  }

  console.log('=== Loading SMG session ===');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    // Load SMG session
    const session = JSON.parse(readFileSync(SMG_SESSION_FILE, 'utf-8'));
    const context = await browser.newContext();
    await context.addCookies(session.cookies || session);

    const page = await context.newPage();

    // Navigate to SMG dashboard
    console.log('=== Navigating to SMG dashboard ===');
    await page.goto('https://reporting.smg.com/dashboard.aspx?id=5', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    // Find and click the "Comments" tab or navigate to "What Are People Saying?" section
    console.log('=== Looking for Comments tab or "What Are People Saying?" section ===');
    
    // Try multiple selectors to find the Comments tab
    const commentsTabSelectors = [
      'text=Comments',
      'a:has-text("Comments")',
      '[role="tab"]:has-text("Comments")',
      '.tab:has-text("Comments")',
      'button:has-text("Comments")',
    ];

    let commentsTabClicked = false;
    for (const selector of commentsTabSelectors) {
      try {
        const tab = await page.locator(selector).first();
        const isVisible = await tab.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          await tab.click();
          console.log(`=== Clicked Comments tab with selector: ${selector} ===`);
          commentsTabClicked = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // If not found by selectors, try finding by evaluating page content
    if (!commentsTabClicked) {
      console.log('=== Trying to find Comments tab by evaluating page content ===');
      const found = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('a, button, [role="tab"], .tab'));
        const commentsTab = elements.find(el => 
          el.textContent?.toLowerCase().includes('comment') ||
          el.textContent?.toLowerCase().includes('what are people saying')
        );
        if (commentsTab) {
          (commentsTab as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (!found) {
        // Get all links/tabs for debugging
        const allTabs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a, button, [role="tab"], .tab')).map(el => ({
            text: el.textContent?.trim(),
            tag: el.tagName,
            classes: el.className
          }));
        });
        console.log('Available tabs/links:', JSON.stringify(allTabs.slice(0, 20), null, 2));
        throw new Error('Could not find "Comments" tab or "What Are People Saying?" section on the SMG page');
      }
    }

    // Wait for Angular to render - wait for Angular-specific elements and ensure content is loaded
    console.log('=== Waiting for Angular to render comments ===');
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for Angular to be ready (check for ng-app or Angular-specific attributes)
    await page.waitForFunction(() => {
      // Check if Angular has loaded by looking for ng-app, ng-controller, or Angular elements
      const hasAngular = document.querySelector('[ng-app], [ng-controller], [ng-repeat], comment-report-item, .comment-list');
      // Also check if jQuery is done (common in AngularJS apps)
      const jqReady = !window.jQuery || window.jQuery.active === 0;
      return hasAngular && jqReady;
    }, { timeout: 30000 }).catch(() => {
      console.log('⚠️  Angular ready check timed out, continuing anyway...');
    });
    
    // Wait for the actual comment content to appear
    await page.waitForSelector('.comment-list, comment-report-item, [class*="comment"]', { 
      timeout: 15000,
      state: 'attached'
    }).catch(() => {
      console.log('⚠️  Comment container selector not found, continuing...');
    });
    
    // Additional wait to ensure Angular has fully rendered the comment list
    await page.waitForTimeout(3000);

    // Scroll down slightly to ensure first 20 comments are loaded (no need to scroll much for top 20)
    console.log('=== Ensuring top comments are visible ===');
    await page.evaluate(() => window.scrollTo(0, 0)); // Start at top
    await page.waitForTimeout(1000);
    // Small scroll to trigger any lazy loading
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(2000);

    // Debug: Get the actual HTML structure to see comment DOM
    const pageHTML = await page.evaluate(() => {
      // Find the comments container - try multiple selectors
      const selectors = [
        '.commentStreamContainer',
        '.comment-stream',
        '[class*="commentStream"]',
        '[class*="comment-list"]',
        '[ng-repeat*="comment"]',
        '.comment-item',
        '.case-item'
      ];
      
      let container = null;
      for (const sel of selectors) {
        container = document.querySelector(sel);
        if (container) break;
      }
      
      // If no container found, look for elements with comment-related classes
      if (!container) {
        const allDivs = Array.from(document.querySelectorAll('div'));
        container = allDivs.find(div => 
          div.className && (
            div.className.includes('comment') || 
            div.className.includes('case') ||
            div.className.includes('stream')
          )
        );
      }
      
      if (container) {
        return {
          containerClass: container.className,
          html: container.innerHTML.slice(0, 5000),
          childCount: container.children.length
        };
      } else {
        // Return body HTML and list all divs with classes
        const divsWithClasses = Array.from(document.querySelectorAll('div[class]'))
          .slice(0, 50)
          .map(div => ({ class: div.className, text: div.textContent?.slice(0, 100) }));
        return {
          containerClass: 'NOT_FOUND',
          html: document.body.innerHTML.slice(0, 5000),
          divsWithClasses: divsWithClasses
        };
      }
    });
    console.log('=== Comments HTML Debug ===');
    console.log('Container class:', pageHTML.containerClass);
    console.log('Child count:', pageHTML.childCount || 'N/A');
    if (pageHTML.divsWithClasses) {
      console.log('Divs with classes:', JSON.stringify(pageHTML.divsWithClasses, null, 2));
    }
    console.log('HTML sample:', pageHTML.html);

    // Scrape comments using the actual DOM structure
    console.log('=== Scraping comments ===');
    const comments = await page.evaluate(() => {
      const scrapedComments = [];
      
      let currentDate = null;

      // CSS/HTML code patterns to filter out (inline)
      const cssHtmlPatterns = [
        /\{/,
        /color\s*:/,
        /!important/,
        /--green/,
        /--[a-z-]+:/,
        /background\s*:/,
        /font-size\s*:/,
        /margin\s*:/,
        /padding\s*:/,
        /<style/,
        /<\/style>/,
        /\.css/,
        /#[0-9a-fA-F]{3,6}/,
        /rgba?\(/,
        /@media/,
        /@keyframes/,
      ];

      // Find all comment-report-item elements
      const commentItems = Array.from(document.querySelectorAll('comment-report-item'));
      
      for (const item of commentItems) {
        // Find the nearest .day-label above this item for date
        let itemDate = currentDate;
        let parent = item.parentElement;
        while (parent && !itemDate) {
          const dayLabel = parent.querySelector('.day-label');
          if (dayLabel) {
            const dateText = dayLabel.textContent?.trim() || '';
          const dateMatch = dateText.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
          if (dateMatch) {
              itemDate = dateMatch[0];
              currentDate = itemDate; // Update current date for subsequent items
            }
          }
          parent = parent.parentElement;
        }

        // Extract store_id from .smg-report-item-left
          const storeIdEl = item.querySelector('.smg-report-item-left');
          const storeId = storeIdEl?.textContent?.trim() || null;

        // Extract survey_type from .smg-report-item-right
          const surveyTypeEl = item.querySelector('.smg-report-item-right');
          const surveyType = surveyTypeEl?.textContent?.trim() || null;

        // Extract comment text - try multiple selectors
        let rawText = '';
        const textSelectors = [
          '.smg-report-item-text',
          '.smg-report-item-partial-multiple p',
          '.smg-report-item-partial-multiple'
        ];
        
        for (const selector of textSelectors) {
          const textEl = item.querySelector(selector);
          if (textEl) {
            rawText = textEl.textContent?.trim() || '';
            if (rawText && rawText.length > 5) break;
          }
        }

        if (!rawText || rawText.length < 5) continue;

        // Inline CSS/HTML code check
        const isCSSOrHTML = cssHtmlPatterns.some(function(pattern) { return pattern.test(rawText); });
        if (isCSSOrHTML) continue;

        // Inline clean comment text - remove "View More", "View Less", "Topics:" and everything after
        let cleaned = rawText;
        // Remove everything from "View More" onwards (case insensitive, matches "View More" or "ViewLess" etc)
        const viewMoreMatch = cleaned.match(/View\s*More/i);
        if (viewMoreMatch && viewMoreMatch.index !== undefined) {
          cleaned = cleaned.substring(0, viewMoreMatch.index).trim();
        }
        // Remove "View Less" if it appears anywhere
        cleaned = cleaned.replace(/View\s*Less/gi, '').trim();
        // Remove "Topics:" and everything after it (case insensitive)
        const topicsMatch = cleaned.match(/Topics\s*:/i);
        if (topicsMatch && topicsMatch.index !== undefined) {
          cleaned = cleaned.substring(0, topicsMatch.index).trim();
        }
        // Remove any trailing topic-like patterns (comma-separated capitalized words at the end)
        cleaned = cleaned.replace(/,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s*,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)*$/g, '').trim();

        // Inline category extraction from first line
        let category = null;
        const lines = cleaned.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        if (lines.length > 0) {
          const firstLine = lines[0];
          if (/^Compliment/i.test(firstLine)) {
            category = 'Compliment';
            cleaned = cleaned.replace(/^Compliment\s*:?\s*/i, '').trim();
          } else if (/^Complaint/i.test(firstLine)) {
            category = 'Complaint';
            cleaned = cleaned.replace(/^Complaint\s*:?\s*/i, '').trim();
          } else if (/^Suggestion/i.test(firstLine)) {
            category = 'Suggestion';
            cleaned = cleaned.replace(/^Suggestion\s*:?\s*/i, '').trim();
          } else if (/^Feedback Agent/i.test(firstLine)) {
            category = 'Feedback Agent';
            cleaned = cleaned.replace(/^Feedback Agent\s*:?\s*/i, '').trim();
          } else if (/^Why Highly Satisfied/i.test(firstLine)) {
            category = 'Why Highly Satisfied';
            cleaned = cleaned.replace(/^Why Highly Satisfied\s*:?\s*/i, '').trim();
          } else if (/^Why not Highly Satisfied/i.test(firstLine)) {
            category = 'Why not Highly Satisfied';
            cleaned = cleaned.replace(/^Why not Highly Satisfied\s*:?\s*/i, '').trim();
          } else if (/^Why Highly/i.test(firstLine)) {
            category = 'Why Highly Satisfied';
            cleaned = cleaned.replace(/^Why Highly\s*:?\s*/i, '').trim();
          } else if (/^Why not Highly/i.test(firstLine)) {
            category = 'Why not Highly Satisfied';
            cleaned = cleaned.replace(/^Why not Highly\s*:?\s*/i, '').trim();
          }
        }

        // Final CSS/HTML check on cleaned text
        const isCleanedCSSOrHTML = cssHtmlPatterns.some(function(pattern) { return pattern.test(cleaned); });
        if (isCleanedCSSOrHTML) continue;

        // Only add if we have store_id and valid comment text
        if (storeId && cleaned && cleaned.length > 5) {
                scrapedComments.push({
                  store_id: storeId,
            comment_date: itemDate,
                  survey_type: surveyType,
                  category: category,
            comment_text: cleaned
                });
        }
      }

      // Return top 20 most recent comments
      return scrapedComments.slice(0, 20);
    });

    console.log(`✅ Scraped ${comments.length} comments`);

    if (comments.length === 0) {
      console.log('ℹ️  No new comments found - SMG may not have new comments since last scrape');
      return;
    }

    // Prepare comments for Supabase
    const commentsToUpsert = comments.map(comment => {
        // Generate comment_id using only store_id + first 80 chars of comment_text (no date)
        const commentId = generateCommentId(
          comment.store_id || '',
          comment.comment_text || ''
        );

        return {
          comment_id: commentId,
          store_id: comment.store_id,
          comment_date: comment.comment_date || null,
          survey_type: comment.survey_type,
          category: comment.category,
          comment_text: comment.comment_text,
          scraped_at: new Date().toISOString()
        };
      });

      // Upsert to Supabase
      console.log('=== Saving comments to Supabase ===');
      const { error } = await supabase
        .from('smg_comments')
        .upsert(commentsToUpsert, { onConflict: 'comment_id' });

      if (error) {
        console.error('❌ Supabase upsert failed:', error.message);
        throw error;
      } else {
        console.log(`✅ Successfully saved ${commentsToUpsert.length} comments to Supabase`);
      }

  } catch (error: any) {
    console.error('❌ Error scraping comments:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run if called directly
if (require.main === module) {
  scrapeComments().catch((error) => {
    console.error('Failed to scrape SMG comments:', error);
    process.exit(1);
  });
}

export { scrapeComments };

