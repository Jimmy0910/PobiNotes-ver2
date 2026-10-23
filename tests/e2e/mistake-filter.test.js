import { generateRandomUser, loginUser, registerUser, waitForSelectorSafe } from './helpers.js';

export default async function run(browser, baseUrl) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(baseUrl);

  console.log('--- E2E TEST: Mistake Filtering (R4) ---');

  const testUser = generateRandomUser();
  const placeholderPass = 'password_placeholder_123';
  await registerUser(page, testUser, placeholderPass);
  await loginUser(page, testUser, placeholderPass);
  await waitForSelectorSafe(page, 'header');

  // Navigate to '所有錯題' list if currently on dashboard
  const allMistakesBtn = await page.$('[data-testid="nav-all-mistakes"]');
  if (allMistakesBtn) {
    await allMistakesBtn.click();
    await new Promise(r => setTimeout(r, 600));
  }

  // Verify date inputs exist
  console.log('📅 Locating date filter inputs...');
  const dateInputs = await page.$$('input[type="date"]');
  if (dateInputs.length < 2) {
    throw new Error('Date filter inputs (start date and end date) not found in UI.');
  }
  console.log('✅ Date range inputs found.');

  // Set date ranges
  console.log('⌨️ Setting filter dates...');
  // Fill start date
  await dateInputs[0].type('2026-07-01');
  // Fill end date
  await dateInputs[1].type('2026-07-31');

  // Verify difficulty filter checkboxes
  console.log('🔍 Locating difficulty checkboxes (會, 卡, 不會, 誤解)...');
  const difficultyLevels = ['會', '卡', '不會', '誤解'];
  
  const checkboxesFound = await page.evaluate((levels) => {
    const labels = Array.from(document.querySelectorAll('label'));
    const foundLevels = [];
    labels.forEach(label => {
      levels.forEach(level => {
        if (label.textContent.includes(level)) {
          const input = label.querySelector('input[type="checkbox"]');
          if (input) {
            foundLevels.push(level);
          }
        }
      });
    });
    return foundLevels;
  }, difficultyLevels);

  console.log(`Found checkboxes for: ${checkboxesFound.join(', ')}`);
  
  if (checkboxesFound.length < 4) {
    throw new Error(`Could not find checkboxes for all four difficulty levels. Found: ${checkboxesFound.join(', ')}`);
  }

  // Click the '會' checkbox to toggle
  console.log('🖱️ Clicking difficulty checkbox...');
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find(l => l.textContent.includes('會'));
    if (label) {
      const checkbox = label.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.click();
    }
  });

  console.log('✅ Filter inputs and checkboxes successfully interacted with.');
  await page.close();
}
