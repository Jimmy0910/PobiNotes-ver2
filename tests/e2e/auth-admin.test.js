import { generateRandomUser, loginUser, registerUser, waitForSelectorSafe } from './helpers.js';

export default async function run(browser, baseUrl) {
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(baseUrl);

  console.log('--- E2E TEST: Auth & Admin Panel (R3) ---');

  // Test 1: Normal User Auth
  const normalUser = generateRandomUser();
  const placeholderPass = 'password_placeholder_123';
  await registerUser(page, normalUser, placeholderPass);
  await loginUser(page, normalUser, placeholderPass);

  // Verify dashboard header is present
  await waitForSelectorSafe(page, 'header');
  console.log('✅ Normal user logged in and reached dashboard.');

  // Log out
  const logoutBtn = await waitForSelectorSafe(page, 'header button', 2000).catch(() => null);
  if (logoutBtn) {
    // Look specifically for the logout button containing '登出' text
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('header button'));
      const logout = btns.find(b => b.textContent.includes('登出'));
      if (logout) {
        logout.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await new Promise(r => setTimeout(r, 1000));
      console.log('✅ Logged out successfully.');
    }
  }

  // Test 2: Admin Registration & Single Admin Lock (R3)
  const adminUser1 = generateRandomUser();
  await registerUser(page, adminUser1, placeholderPass, true);

  // Attempt to register a second admin (which should fail)
  const adminUser2 = generateRandomUser();
  console.log('🔒 Testing admin registration lock...');
  
  // Directly evaluate second registration payload at backend API level to assert R3 lock
  const secondAdminResult = await page.evaluate(async (u, p) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p, is_admin: true })
      });
      return { status: res.status, body: await res.json() };
    } catch (e) {
      return { error: e.message };
    }
  }, adminUser2, placeholderPass);

  if (secondAdminResult.status === 400 && secondAdminResult.body?.error?.includes('Admin account already exists')) {
    console.log('✅ Admin registration lock enforced successfully! Second admin registration blocked.');
  } else {
    throw new Error(`Admin registration lock failed. Response: ${JSON.stringify(secondAdminResult)}`);
  }

  // Test 3: Log in as admin and verify admin dashboard
  await loginUser(page, adminUser1, placeholderPass);
  await waitForSelectorSafe(page, 'header');

  // Verify Admin Dashboard trigger is visible and can be clicked (Admin only)
  console.log('🔍 Checking Admin Dashboard UI trigger...');
  
  const hasAdminDashboard = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const adminBtn = btns.find(b => b.textContent.includes('管理員控制台') || b.textContent.includes('管理員'));
    if (adminBtn) {
      adminBtn.click();
      return true;
    }
    return false;
  });

  if (hasAdminDashboard) {
    await new Promise(r => setTimeout(r, 1000));
    console.log('✅ Switched to Admin Dashboard.');
    
    // Verify admin dashboard components are loaded (like users table)
    await waitForSelectorSafe(page, 'table');
    console.log('✅ Admin Dashboard lists registered users.');
  } else {
    throw new Error('Admin Dashboard trigger button containing "管理員控制台" was not found in UI.');
  }

  // Clean up admin account so subsequent E2E tests in the suite can also test admin registration
  await page.evaluate(async () => {
    await fetch('/api/users/delete', { method: 'DELETE' });
  });

  await page.close();
}
