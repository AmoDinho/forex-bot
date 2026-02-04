/**
 * Browser Session Setup Script
 *
 * Run this script to set up your browser session:
 * 1. Opens a visible browser window
 * 2. Navigates to the forex chart site
 * 3. You manually accept cookies and configure the page
 * 4. Press Enter in the terminal when done
 * 5. Session is saved for future use
 *
 * Usage: npx tsx src/scripts/setup-browser.ts
 */

import { chromium } from 'playwright';
import * as path from 'node:path';
import * as readline from 'node:readline';

const USER_DATA_DIR =
  process.env.BROWSER_USER_DATA_DIR ||
  path.resolve(process.cwd(), 'browser-data');

const SITES_TO_SETUP = [
  'https://www.livecharts.co.uk/ForexCharts/eurusd.php',
  // Add more sites here if needed
];

async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  console.log('🔧 Browser Session Setup');
  console.log('========================\n');
  console.log(`User data directory: ${USER_DATA_DIR}\n`);

  // Launch browser with persistent context
  console.log('Launching browser...');
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });

  const page = context.pages()[0] || (await context.newPage());

  console.log('\n📋 Instructions:');
  console.log('1. The browser will open and navigate to forex chart sites');
  console.log('2. Accept any cookie banners or consent dialogs');
  console.log('3. Configure the charts as you like (timeframe, indicators, etc.)');
  console.log('4. When finished, come back here and press Enter');
  console.log('\n');

  // Navigate to each site
  for (const site of SITES_TO_SETUP) {
    console.log(`Opening: ${site}`);
    try {
      await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('✓ Page loaded\n');
    } catch (error) {
      console.log(`⚠ Could not load ${site}, continuing...\n`);
    }
  }

  await waitForEnter('Press Enter when you have finished setting up the browser session...');

  // Close browser - session is automatically saved
  console.log('\nSaving session and closing browser...');
  await context.close();

  console.log('\n✅ Browser session saved!');
  console.log(`   Location: ${USER_DATA_DIR}`);
  console.log('\nYou can now run the main app with:');
  console.log('   yarn dev');
  console.log('\nThe agent will use your saved session with cookies accepted.');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
