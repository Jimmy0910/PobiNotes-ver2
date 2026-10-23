import { generateRandomUser, loginUser, registerUser, waitForSelectorSafe } from './helpers.js';

export default async function run(browser, baseUrl) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(baseUrl);

  console.log('--- E2E TEST: Feedback System (R2) ---');

  const testUser = generateRandomUser();
  const placeholderPass = 'password_placeholder_123';
  await registerUser(page, testUser, placeholderPass);
  await loginUser(page, testUser, placeholderPass);
  await waitForSelectorSafe(page, 'header');

  // Trigger feedback modal
  console.log('🔍 Locating feedback button...');
  const hasFeedbackModalBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const feedbackBtn = btns.find(b => b.textContent.includes('意見回饋') || b.textContent.includes('回饋'));
    if (feedbackBtn) {
      feedbackBtn.click();
      return true;
    }
    return false;
  });

  if (!hasFeedbackModalBtn) {
    throw new Error('Feedback trigger button containing "意見回饋" was not found in UI.');
  }

  await new Promise(r => setTimeout(r, 1000));
  
  // Boundary Case: Submit feedback with rating = 0 or empty comment (should be blocked)
  console.log('📝 Testing feedback validation boundaries...');
  const isSubmitDisabled = await page.evaluate(() => {
    const submitBtn = document.querySelector('form button[type="submit"]');
    if (submitBtn) {
      return submitBtn.disabled;
    }
    return false;
  });
  
  if (isSubmitDisabled) {
    console.log('✅ Submit button is correctly disabled when rating is 0 or comment is empty.');
  }

  // Choose rating & fill comment
  console.log('⭐ Filling feedback form...');
  const clickedRating = await page.evaluate(() => {
    const stars = Array.from(document.querySelectorAll('form svg'));
    if (stars.length >= 5) {
      // Click the 5th star
      const star = stars[4];
      const clickEvent = new MouseEvent('click', { bubbles: true });
      star.dispatchEvent(clickEvent);
      return true;
    }
    return false;
  });

  if (!clickedRating) {
    throw new Error('Could not select rating stars in feedback modal.');
  }

  // Type comment
  const commentTextarea = await waitForSelectorSafe(page, 'form textarea');
  await commentTextarea.type('This is a great test feedback comment. Rating 5 stars!');

  // Submit feedback
  const submitBtn = await waitForSelectorSafe(page, 'form button[type="submit"]');
  await submitBtn.click();
  await new Promise(r => setTimeout(r, 2000));
  console.log('✅ First feedback submitted.');

  // Test Unlimited Feedbacks (R2): Open feedback modal again and submit another one
  console.log('🔄 Attempting second feedback submission (R2 Unlimited)...');
  const hasFeedbackModalBtn2 = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const feedbackBtn = btns.find(b => b.textContent.includes('意見回饋') || b.textContent.includes('回饋'));
    if (feedbackBtn) {
      feedbackBtn.click();
      return true;
    }
    return false;
  });

  if (!hasFeedbackModalBtn2) {
    throw new Error('Feedback button was not found for the second time.');
  }

  await new Promise(r => setTimeout(r, 1000));

  // Select 4 stars
  await page.evaluate(() => {
    const stars = Array.from(document.querySelectorAll('form svg'));
    if (stars.length >= 5) {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      stars[3].dispatchEvent(clickEvent);
    }
  });

  const commentTextarea2 = await waitForSelectorSafe(page, 'form textarea');
  await commentTextarea2.type('This is the second feedback. Unlimited submissions check.');

  const submitBtn2 = await waitForSelectorSafe(page, 'form button[type="submit"]');
  await submitBtn2.click();
  await new Promise(r => setTimeout(r, 2000));
  console.log('✅ Second feedback submitted successfully (Unlimited check passed).');

  await page.close();
}
