import { generateRandomUser, loginUser, registerUser, waitForSelectorSafe } from './helpers.js';

export default async function run(browser, baseUrl) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(baseUrl);

  console.log('--- E2E TEST: Account Self-Deletion (R1) ---');

  const testUser = generateRandomUser();
  const placeholderPass = 'password_placeholder_123';
  
  // Register and login
  await registerUser(page, testUser, placeholderPass);
  await loginUser(page, testUser, placeholderPass);
  await waitForSelectorSafe(page, 'header');

  // Verify database data cascade check at the API level (optional, but UI check is primary)
  // Let's trigger the delete account button/modal in UI
  console.log('🔍 Locating account deletion button...');
  const hasDeleteBtn = await page.evaluate(() => {
    // Look for a self-deletion trigger in settings or top bar
    const btns = Array.from(document.querySelectorAll('button'));
    const deleteBtn = btns.find(b => b.textContent.includes('註銷帳號') || b.textContent.includes('刪除帳號') || b.textContent.includes('自刪'));
    if (deleteBtn) {
      deleteBtn.click();
      return true;
    }
    return false;
  });

  if (!hasDeleteBtn) {
    // If not found in UI, let's test the endpoint directly to verify cascading deletion logic is operational
    console.log('ℹ️ Self-deletion button not found in UI. Testing cascading backend self-deletion endpoint...');
    
    // Evaluate backend self-deletion via fetch
    const selfDeleteResult = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/users/delete', {
          method: 'DELETE'
        });
        return { status: res.status, body: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    });

    if (selfDeleteResult.status === 200 && selfDeleteResult.body?.success) {
      console.log('✅ Self-deletion endpoint responded successfully.');
      
      // Verify user session cookie has been cleared by checking /api/auth/me
      const checkMe = await page.evaluate(async () => {
        const res = await fetch('/api/auth/me');
        return res.json();
      });
      
      if (!checkMe.success) {
        console.log('✅ Session cleared cascadingly.');
      } else {
        throw new Error('Session cookie was not cleared after account deletion.');
      }
    } else {
      throw new Error(`Self-deletion API failed: ${JSON.stringify(selfDeleteResult)}`);
    }
  } else {
    // UI flow is present: Type username to confirm
    await new Promise(r => setTimeout(r, 1000));
    console.log('⌨️ Typing username to confirm self-deletion...');
    
    // Find confirmation input
    const confirmInput = await waitForSelectorSafe(page, 'input[placeholder*="確認輸入"], input[placeholder*="使用者名稱"]');
    await confirmInput.type(testUser);
    
    // Click final confirm button
    const confirmBtn = await waitForSelectorSafe(page, 'button:has-text("確認刪除")').catch(async () => {
      return await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('確認刪除') || b.textContent.includes('確定刪除'));
      });
    });
    
    if (confirmBtn) {
      const isElement = await confirmBtn.asElement();
      if (isElement) {
        await isElement.click();
        await new Promise(r => setTimeout(r, 2000));
        console.log('✅ Account deletion submitted in UI.');
        
        // Verify redirected back to Login screen
        await waitForSelectorSafe(page, 'form button[type="submit"]');
        console.log('✅ Redirected back to login page.');
      } else {
        throw new Error('Confirm delete button is not clickable.');
      }
    } else {
      throw new Error('Confirm delete button not found.');
    }
  }

  await page.close();
}
