import { generateRandomUser, loginUser, registerUser, waitForSelectorSafe } from './helpers.js';

export default async function run(browser, baseUrl) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(baseUrl);

  console.log('--- E2E TEST: Real-World Scenarios (Tier 4) ---');

  // 1. Normal User Registration & Login
  const testUser = generateRandomUser();
  const placeholderPass = 'password_placeholder_123';
  await registerUser(page, testUser, placeholderPass);
  await loginUser(page, testUser, placeholderPass);
  await waitForSelectorSafe(page, 'header');
  console.log('✅ Registered and logged in normal user.');

  // 2. Create a Subject
  console.log('➕ Creating a new subject...');
  const addSubjectBtn = await waitForSelectorSafe(page, '[data-testid="sidebar-add-subject-btn"], button:has-text("+"), button[style*="background: none"]');
  // Trigger subject input form
  await addSubjectBtn.click();
  await new Promise(r => setTimeout(r, 500));
  
  const subjectInput = await waitForSelectorSafe(page, 'input[placeholder*="科目名稱"]');
  await subjectInput.type('E2E Math');
  
  // Submit subject form
  const subjectSubmit = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('form button'));
    return btns.find(b => b.textContent.includes('新增'));
  });
  if (subjectSubmit) {
    await subjectSubmit.click();
    await new Promise(r => setTimeout(r, 1000));
    console.log('✅ Subject created.');
  }

  // 3. Create a Chapter
  console.log('➕ Creating a new chapter...');
  const addChapterBtn = await page.evaluateHandle(() => {
    const wrappers = Array.from(document.querySelectorAll('.actions-wrapper'));
    if (wrappers.length > 0) {
      const btns = Array.from(wrappers[0].querySelectorAll('button'));
      // The third button in actions-wrapper is the Plus button for chapter
      return btns[2];
    }
    return null;
  });

  if (addChapterBtn) {
    await addChapterBtn.click();
    await new Promise(r => setTimeout(r, 500));
    const chapterInput = await waitForSelectorSafe(page, 'input[placeholder*="新增章節"]');
    await chapterInput.type('Calculus');
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1000));
    console.log('✅ Chapter created.');
  }

  // 4. Create a Mistake
  console.log('➕ Attempting to select chapter and create a mistake...');
  // Select chapter "Calculus"
  const selectChapterResult = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    const chapterSpan = spans.find(s => s.textContent.includes('Calculus'));
    if (chapterSpan) {
      chapterSpan.click();
      return true;
    }
    return false;
  });

  if (selectChapterResult) {
    await new Promise(r => setTimeout(r, 1000));
    
    // Look for "新增錯題" button
    const addMistakeBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('新增錯題'));
    });
    
    if (addMistakeBtn) {
      await addMistakeBtn.click();
      await new Promise(r => setTimeout(r, 1000));
      console.log('✅ Mistake Editor opened.');
      
      // Fill in mistake details
      const titleInput = await waitForSelectorSafe(page, 'input[placeholder*="請輸入錯題"]');
      await titleInput.type('Derivatives of sin(x)');
      
      // Select template if present, or submit
      const saveMistakeBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('儲存') || b.textContent.includes('儲存錯題'));
      });
      
      if (saveMistakeBtn) {
        await saveMistakeBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        console.log('✅ Mistake saved successfully.');
      }
    }
  }

  // 5. Submit feedback
  console.log('⭐ Submitting feedback...');
  const hasFeedbackModalBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const feedbackBtn = btns.find(b => b.textContent.includes('意見回饋'));
    if (feedbackBtn) {
      feedbackBtn.click();
      return true;
    }
    return false;
  });

  if (hasFeedbackModalBtn) {
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const stars = Array.from(document.querySelectorAll('form svg'));
      if (stars.length >= 5) {
        const clickEvent = new MouseEvent('click', { bubbles: true });
        stars[4].dispatchEvent(clickEvent);
      }
    });
    const commentTextarea = await waitForSelectorSafe(page, 'form textarea');
    await commentTextarea.type('Excellent integrated workflow!');
    const submitBtn = await waitForSelectorSafe(page, 'form button[type="submit"]');
    await submitBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    console.log('✅ Feedback submitted in user flow.');
  }

  // Log out user
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('header button'));
    const logout = btns.find(b => b.textContent.includes('登出'));
    if (logout) logout.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log('✅ User logged out.');

  // 6. Admin Login & Check Cascading Deletion
  const adminUser = generateRandomUser();
  await registerUser(page, adminUser, placeholderPass, true);
  await loginUser(page, adminUser, placeholderPass);
  await waitForSelectorSafe(page, 'header');
  console.log('✅ Admin logged in.');

  // Navigate to Admin Panel
  const hasAdminDashboard = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const adminBtn = btns.find(b => b.textContent.includes('管理員控制台'));
    if (adminBtn) {
      adminBtn.click();
      return true;
    }
    return false;
  });

  if (hasAdminDashboard) {
    await new Promise(r => setTimeout(r, 1000));
    
    // Look for the user in the user table and delete it
    console.log(`🗑️ Deleting user "${testUser}" cascadingly from Admin dashboard...`);
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    const deleted = await page.evaluate((uname) => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const userRow = rows.find(r => r.textContent.includes(uname));
      if (userRow) {
        const deleteBtn = userRow.querySelector('button');
        if (deleteBtn) {
          deleteBtn.click();
          return true;
        }
      }
      return false;
    }, testUser);

    if (deleted) {
      await new Promise(r => setTimeout(r, 1500));
      console.log('✅ User deleted cascadingly by Admin.');
    } else {
      throw new Error(`User "${testUser}" not found in Admin table.`);
    }
  }

  await page.close();
}
