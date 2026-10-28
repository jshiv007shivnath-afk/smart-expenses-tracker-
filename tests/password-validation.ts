import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173');
  
  // Wait for load
  await page.waitForTimeout(3000);
  
  // Need to bypass local storage check or click get started
  await page.waitForTimeout(2000);
  
  try {
     // Check if we are on splash screen
     console.log("Checking UI state...");
  } catch(e) {
  }
  
  await browser.close();
})();
