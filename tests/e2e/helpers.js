import puppeteer from 'puppeteer';

// Helper to generate a unique username to avoid collisions
export function generateRandomUser() {
  return `user_placeholder_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// Safely wait for a selector with a customized timeout, throwing a meaningful error if missing
export async function waitForSelectorSafe(page, selector, timeout = 2500) {
  try {
    if (selector.includes(':has-text(')) {
      const match = selector.match(/([a-zA-Z0-9_-]+):has-text\(["'](.+)["']\)/);
      if (match) {
        const [, tag, text] = match;
        try {
          await page.waitForFunction(
            (t, txt) => Array.from(document.querySelectorAll(t)).some(el => el.textContent && el.textContent.includes(txt)),
            { timeout: 1200 },
            tag,
            text
          );
          const handle = await page.evaluateHandle(
            (t, txt) => Array.from(document.querySelectorAll(t)).find(el => el.textContent && el.textContent.includes(txt)),
            tag,
            text
          );
          if (handle && handle.asElement()) return handle;
        } catch {
          // fallback
        }
      }
      const parts = selector.split(',').map(s => s.trim());
      const validCssParts = parts.filter(p => !p.includes(':has-text('));
      if (validCssParts.length > 0) {
        return await page.waitForSelector(validCssParts.join(', '), { timeout });
      }
    }
    return await page.waitForSelector(selector, { timeout });
  } catch {
    throw new Error(`Required selector "${selector}" was not found. Feature may not be implemented yet.`);
  }
}

// Helper to switch to register tab and register a user
export async function registerUser(page, username, password, isAdmin = false) {
  console.log(`📝 Registering user "${username}" (admin: ${isAdmin})...`);
  
  // Clear any logged in session to get back to the login/register page
  const cookies = await page.cookies();
  if (cookies.some(c => c.name === 'authToken')) {
    console.log('🧹 Clearing session cookie for isolation...');
    await page.deleteCookie({ name: 'authToken' });
    await page.reload();
    await new Promise(r => setTimeout(r, 1000));
  }

  // Click the toggle button to switch to Registration mode
  // The login form has a button at the bottom: "立即註冊"
  const toggleBtn = await waitForSelectorSafe(page, 'button:not([type="submit"])');
  await toggleBtn.click();
  await new Promise(r => setTimeout(r, 500));

  // Fill in the input fields
  const usernameInput = await waitForSelectorSafe(page, 'input[type="text"]');
  await page.evaluate(el => el.value = '', usernameInput);
  await usernameInput.type(username);

  const passwordInput = await waitForSelectorSafe(page, 'input[type="password"]');
  await page.evaluate(el => el.value = '', passwordInput);
  await passwordInput.type(password);

  // If registering as admin, we need to pass it to the register request.
  // Since there is no admin checkbox in the current front-end, the actual register test
  // will either need to intercept/evaluate a custom register call or click a checkbox if present.
  // We can do both: look for a checkbox, and if not present, evaluate a custom fetch request in the browser.
  if (isAdmin) {
    const hasAdminCheckbox = await page.$('input[name="is_admin"]');
    if (hasAdminCheckbox) {
      await hasAdminCheckbox.click();
    } else {
      console.log('ℹ️ Admin checkbox not found in UI, executing registration via API fetch evaluation...');
      const registerResult = await page.evaluate(async (u, p) => {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p, is_admin: true })
        });
        return res.json();
      }, username, password);
      
      if (registerResult.error) {
        throw new Error(`API registration failed: ${registerResult.error}`);
      }
      
      console.log('✅ Registered admin successfully via API evaluation.');
      // Switch back to login view to proceed
      return;
    }
  }

  // Click submit to register
  const submitBtn = await waitForSelectorSafe(page, 'button[type="submit"]');
  await submitBtn.click();
  console.log('✅ Registration submit clicked. Waiting for transition to login...');

  // Wait for registration to complete and auto-toggle back to Login mode (button text becomes "登入")
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]');
    return btn && btn.textContent.includes('登入');
  }, { timeout: 6000 }).catch(() => {
    console.log('⚠️ Timeout waiting for registration transition.');
  });

  const regError = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const errEl = els.find(el => el.style.color === 'var(--danger)' || el.textContent.includes('錯誤'));
    return errEl ? errEl.textContent : null;
  });
  if (regError) {
    console.log('❌ UI Registration Error:', regError);
  }
}

// Helper to log in a registered user
export async function loginUser(page, username, password) {
  console.log(`🔑 Logging in user "${username}"...`);
  
  // Ensure we are in Login mode (toggle if needed, check submit button text or header)
  const submitBtn = await waitForSelectorSafe(page, 'button[type="submit"]');
  const btnText = await page.evaluate(el => el.textContent, submitBtn);
  if (!btnText.includes('登入')) {
    const toggleBtn = await waitForSelectorSafe(page, 'button:not([type="submit"])');
    await toggleBtn.click();
    await new Promise(r => setTimeout(r, 500));
  }

  const usernameInput = await waitForSelectorSafe(page, 'input[type="text"]');
  await page.evaluate(el => el.value = '', usernameInput);
  await usernameInput.type(username);

  const passwordInput = await waitForSelectorSafe(page, 'input[type="password"]');
  await page.evaluate(el => el.value = '', passwordInput);
  await passwordInput.type(password);

  const finalSubmit = await waitForSelectorSafe(page, 'button[type="submit"]');
  await finalSubmit.click();
  await new Promise(r => setTimeout(r, 1500));
  console.log('✅ Login submit clicked.');

  const logError = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const errEl = els.find(el => el.style.color === 'var(--danger)' || el.textContent.includes('錯誤'));
    return errEl ? errEl.textContent : null;
  });
  if (logError) {
    console.log('❌ UI Login Error:', logError);
  }
}
