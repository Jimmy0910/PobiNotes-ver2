import { generateRandomUser, loginUser, registerUser, waitForSelectorSafe } from './helpers.js';

export default async function run(browser, baseUrl) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(baseUrl);

  console.log('--- E2E TEST: Collapsible Sidebar (R5) ---');

  const testUser = generateRandomUser();
  const placeholderPass = 'password_placeholder_123';
  await registerUser(page, testUser, placeholderPass);
  await loginUser(page, testUser, placeholderPass);
  await waitForSelectorSafe(page, 'header');

  // Verify sidebar container is visible initially
  console.log('🔍 Checking sidebar visibility...');
  const sidebarExists = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar-container') || document.querySelector('div[style*="width: 300px"]');
    return !!sidebar;
  });

  if (!sidebarExists) {
    throw new Error('Sidebar container was not found on desktop login.');
  }
  console.log('✅ Sidebar is present.');

  // Find collapse button and click it
  console.log('🖱️ Clicking sidebar toggle button...');
  const hasToggleBtn = await page.evaluate(() => {
    // Look for a menu button or chevron in header or sidebar
    const btns = Array.from(document.querySelectorAll('button'));
    const toggle = btns.find(b => b.querySelector('svg') || b.className.includes('toggle') || b.textContent.includes('收折') || b.textContent.includes('展開'));
    if (toggle) {
      toggle.click();
      return true;
    }
    return false;
  });

  if (!hasToggleBtn) {
    throw new Error('Sidebar collapse toggle button not found.');
  }

  await new Promise(r => setTimeout(r, 1000));

  // Verify that the sidebar is collapsed
  const isCollapsed = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar-container') || document.querySelector('div[style*="width: 300px"]');
    if (sidebar) {
      // Check width or class name
      const style = window.getComputedStyle(sidebar);
      const isWidthZero = style.width === '0px' || sidebar.style.width === '0px';
      const hasCollapsedClass = sidebar.classList.contains('sidebar-collapsed');
      return isWidthZero || hasCollapsedClass;
    }
    return false;
  });

  if (!isCollapsed) {
    throw new Error('Sidebar was not collapsed after toggle button was clicked.');
  }

  console.log('✅ Sidebar collapsed successfully.');
  await page.close();
}
