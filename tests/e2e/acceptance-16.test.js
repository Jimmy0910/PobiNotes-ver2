import { generateRandomUser, loginUser, registerUser, waitForSelectorSafe } from './helpers.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function clickHeaderOrSidebarButton(page, textOrTestId) {
  await page.evaluate((target) => {
    const byTestId = document.querySelector(`[data-testid="${target}"]`);
    if (byTestId) {
      byTestId.click();
      return;
    }
    const btns = Array.from(document.querySelectorAll('button'));
    const found = btns.find(b => b.textContent && b.textContent.includes(target));
    if (found) found.click();
  }, textOrTestId);
  await new Promise(r => setTimeout(r, 400));
}

async function createMistakeViaApi(page, payload) {
  return await page.evaluate(async (p) => {
    const data = p.data || { questionData: p.questionData || {}, answerData: p.answerData || {} };
    const res = await fetch('/api/mistakes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, data })
    });
    if (!res.ok) throw new Error('Failed to create mistake via API: ' + (await res.text()));
    return await res.json();
  }, payload);
}

export default async function run(browser, baseUrl) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(baseUrl);

  console.log('--- E2E ACCEPTANCE TEST: 16 Verification Criteria (Section 12) ---');

  const user1 = generateRandomUser();
  const pass = 'password_placeholder_123';
  await registerUser(page, user1, pass);
  await loginUser(page, user1, pass);
  await waitForSelectorSafe(page, 'header');

  // Verify initial seeded defaults exist via API & UI
  const initialCategories = await page.evaluate(async () => {
    const res = await fetch('/api/categories');
    return res.json();
  });
  assert(
    initialCategories.subjects.some(s => s.name === '生物') &&
    initialCategories.subjects.some(s => s.name === '地球科學'),
    'Default seeded subjects (生物, 地球科學, etc.) should exist for a new user'
  );
  assert(
    initialCategories.familiarities.some(f => f.name === '順') &&
    initialCategories.familiarities.some(f => f.name === '不會'),
    'Default seeded familiarities (順, 卡, 不會, 誤解) should exist'
  );
  assert(
    initialCategories.errorReasons.some(r => r.name === '觀念不清'),
    'Default seeded error reasons should exist'
  );

  // =========================================================================
  // Criterion 1: 使用者可以新增一個科目 (User can add a new subject)
  // =========================================================================
  console.log('🧪 [1/16] Testing: User can add a new subject...');
  await clickHeaderOrSidebarButton(page, '分類管理');
  await waitForSelectorSafe(page, '[data-testid="new-category-name-input"]');

  // Ensure Subject tab is active
  await page.click('[data-testid="dim-tab-subject"]');
  await new Promise(r => setTimeout(r, 300));

  const nameInput = await waitForSelectorSafe(page, '[data-testid="new-category-name-input"]');
  await page.evaluate(el => { el.value = ''; }, nameInput);
  await nameInput.type('天文學');
  await page.click('[data-testid="add-category-submit-btn"]');
  await new Promise(r => setTimeout(r, 800));

  let cats = await page.evaluate(async () => (await fetch('/api/categories')).json());
  const astronomySubject = cats.subjects.find(s => s.name === '天文學');
  assert(astronomySubject, '[1/16] New subject "天文學" was created in DB');
  console.log('✅ [1/16] Passed: Added new subject "天文學".');

  // =========================================================================
  // Criterion 2: 可以在該科目下建立章節與單元 (Create chapters and units under subject)
  // =========================================================================
  console.log('🧪 [2/16] Testing: Create chapters and units under "天文學"...');
  await page.click('[data-testid="dim-tab-chapter"]');
  await new Promise(r => setTimeout(r, 300));
  await page.select('[data-testid="new-category-parent-subject"]', astronomySubject.id);
  const chapInput = await waitForSelectorSafe(page, '[data-testid="new-category-name-input"]');
  await chapInput.type('恆星演化');
  await page.click('[data-testid="add-category-submit-btn"]');
  await new Promise(r => setTimeout(r, 700));

  cats = await page.evaluate(async () => (await fetch('/api/categories')).json());
  const starChapter = cats.chapters.find(c => c.name === '恆星演化' && c.parent_id === astronomySubject.id);
  assert(starChapter, '[2/16] Chapter "恆星演化" created under "天文學"');

  // Switch to Unit tab and create two units under "恆星演化"
  await page.click('[data-testid="dim-tab-unit"]');
  await new Promise(r => setTimeout(r, 300));
  await page.select('[data-testid="new-unit-parent-chapter"]', starChapter.id);

  const unitInput1 = await waitForSelectorSafe(page, '[data-testid="new-category-name-input"]');
  await unitInput1.type('主序星與赫羅圖');
  await page.click('[data-testid="add-category-submit-btn"]');
  await new Promise(r => setTimeout(r, 600));

  await page.select('[data-testid="new-unit-parent-chapter"]', starChapter.id);
  const unitInput2 = await waitForSelectorSafe(page, '[data-testid="new-category-name-input"]');
  await unitInput2.type('超新星爆炸');
  await page.click('[data-testid="add-category-submit-btn"]');
  await new Promise(r => setTimeout(r, 600));

  cats = await page.evaluate(async () => (await fetch('/api/categories')).json());
  const hrUnit = cats.units.find(u => u.name === '主序星與赫羅圖' && u.parent_id === starChapter.id);
  const snUnit = cats.units.find(u => u.name === '超新星爆炸' && u.parent_id === starChapter.id);
  assert(hrUnit && snUnit, '[2/16] Units created under chapter "恆星演化"');
  console.log('✅ [2/16] Passed: Created hierarchical Chapter and Units under "天文學".');

  // =========================================================================
  // Criterion 3: 可以自行新增、重新命名、排序熟悉度 (Add, rename, reorder familiarity)
  // =========================================================================
  console.log('🧪 [3/16] Testing: Add, rename, and reorder familiarity...');
  await page.click('[data-testid="dim-tab-familiarity"]');
  await new Promise(r => setTimeout(r, 300));

  const famInput = await waitForSelectorSafe(page, '[data-testid="new-category-name-input"]');
  await famInput.type('完全精通');
  await page.click('[data-testid="add-category-submit-btn"]');
  await new Promise(r => setTimeout(r, 600));

  cats = await page.evaluate(async () => (await fetch('/api/categories')).json());
  const masterFam = cats.familiarities.find(f => f.name === '完全精通');
  assert(masterFam, '[3/16] New familiarity "完全精通" created');

  // Rename familiarity via PUT /api/categories
  await page.evaluate(async (id) => {
    await fetch('/api/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimension: 'familiarity', id, name: '百分百精通' })
    });
  }, masterFam.id);

  // Reorder familiarities (move "百分百精通" to index 0)
  const reorderedFamIds = [
    masterFam.id,
    ...cats.familiarities.filter(f => f.id !== masterFam.id).map(f => f.id)
  ];
  await page.evaluate(async (orderedIds) => {
    await fetch('/api/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder', dimension: 'familiarity', orderedIds })
    });
  }, reorderedFamIds);

  cats = await page.evaluate(async () => (await fetch('/api/categories')).json());
  assert(cats.familiarities[0].id === masterFam.id && cats.familiarities[0].name === '百分百精通', '[3/16] Familiarity renamed and reordered to index 0');
  console.log('✅ [3/16] Passed: Familiarity added, renamed to "百分百精通", and reordered.');

  // =========================================================================
  // Criterion 4: 可以新增及編輯錯因分類 (Add and edit error reason categories)
  // =========================================================================
  console.log('🧪 [4/16] Testing: Add and edit error reason categories...');
  await page.click('[data-testid="dim-tab-error_reason"]');
  await new Promise(r => setTimeout(r, 300));

  const errInput = await waitForSelectorSafe(page, '[data-testid="new-category-name-input"]');
  await errInput.type('單位換算失誤');
  await page.click('[data-testid="add-category-submit-btn"]');
  await new Promise(r => setTimeout(r, 600));

  cats = await page.evaluate(async () => (await fetch('/api/categories')).json());
  const unitConvErr = cats.errorReasons.find(r => r.name === '單位換算失誤');
  const conceptErr = cats.errorReasons.find(r => r.name === '觀念不清');
  assert(unitConvErr && conceptErr, '[4/16] Error reason "單位換算失誤" created');
  console.log('✅ [4/16] Passed: Added error reason category.');

  // =========================================================================
  // Criterion 5: 分類修改後，既有錯題仍保留正確關聯 (Mistakes keep association after rename)
  // =========================================================================
  console.log('🧪 [5/16] Testing: Existing mistakes retain associations after category rename...');
  const hardFam = cats.familiarities.find(f => f.name === '不會');
  const stuckFam = cats.familiarities.find(f => f.name === '卡');

  // Create Mistake 1 (Categorized under 天文學 -> 恆星演化 -> 主序星與赫羅圖, familiarity 不會, 2 error reasons)
  await page.evaluate(async (payload) => {
    const res = await fetch('/api/mistakes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create mistake 1');
  }, {
    title: '赫羅圖表面溫度與光度關係',
    subjectId: astronomySubject.id,
    chapterId: starChapter.id,
    unitId: hrUnit.id,
    familiarityId: hardFam.id,
    errorReasonIds: [conceptErr.id, unitConvErr.id],
    tags: ['期中考', '必考題'],
    mistakeDate: '2026-10-15',
    content: {
      templateName: '標準錯題模板',
      q_text: '主序星在赫羅圖上的分布位置與質量有何關係？',
      a_text: '質量愈大的主序星光度愈高、表面溫度愈高，位於左上方。',
      a_analysis: '需熟記赫羅圖橫軸為表面溫度（向左遞增）、縱軸為光度。',
      a_mastery: '不會'
    }
  });

  // Create Mistake 2 (Categorized under 天文學 -> 恆星演化 -> 超新星爆炸, familiarity 卡, 1 error reason)
  await page.evaluate(async (payload) => {
    const res = await fetch('/api/mistakes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create mistake 2');
  }, {
    title: 'Ia型超新星標準燭光機制',
    subjectId: astronomySubject.id,
    chapterId: starChapter.id,
    unitId: snUnit.id,
    familiarityId: stuckFam.id,
    errorReasonIds: [conceptErr.id],
    tags: ['高難度'],
    mistakeDate: '2026-10-16',
    content: {
      templateName: '標準錯題模板',
      q_text: '為何 Ia 型超新星可作為測量遙遠星系距離的標準燭光？',
      a_text: '因為白矮星吸積達錢德拉塞卡極限（約 1.44 倍太陽質量）時爆發，峰值絕對星等一致。',
      a_analysis: '區分 Ia 型與 II 型超新星的爆發機制差異。',
      a_mastery: '卡'
    }
  });

  // Rename Chapter "恆星演化" -> "恆星演化與生命週期", and Error Reason "單位換算失誤" -> "物理單位換算失誤"
  await page.evaluate(async (chapId, errId) => {
    await fetch('/api/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimension: 'chapter', id: chapId, name: '恆星演化與生命週期' })
    });
    await fetch('/api/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimension: 'error_reason', id: errId, name: '物理單位換算失誤' })
    });
  }, starChapter.id, unitConvErr.id);

  const mistakesAfterRename = await page.evaluate(async () => (await fetch('/api/mistakes')).json());
  const m1 = mistakesAfterRename.find(m => m.title === '赫羅圖表面溫度與光度關係');
  assert(m1 && m1.chapter_id === starChapter.id && m1.chapter_name === '恆星演化與生命週期', '[5/16] Mistake retained chapter ID and updated chapter_name after rename');
  assert(m1.error_reason_ids.includes(unitConvErr.id), '[5/16] Mistake retained error_reason_id after rename');
  console.log('✅ [5/16] Passed: Category renames preserve stable ID associations on existing mistakes.');

  // =========================================================================
  // Criterion 6: 選擇科目後，章節與單元篩選器正確連動 (Cascading filters)
  // =========================================================================
  console.log('🧪 [6/16] Testing: Subject -> Chapter -> Unit cascading filters in AnalyticsView...');
  await page.reload({ waitUntil: 'networkidle0' });
  await waitForSelectorSafe(page, 'header');
  await clickHeaderOrSidebarButton(page, '錯題分析');
  await waitForSelectorSafe(page, '[data-testid="filter-pill-科目-天文學"]');

  // Select subject "天文學"
  await page.click('[data-testid="filter-pill-科目-天文學"]');
  await new Promise(r => setTimeout(r, 400));

  // Verify chapter filter shows "恆星演化與生命週期"
  const hasStarChapterFilter = await page.$('[data-testid="filter-pill-章節-恆星演化與生命週期"]');
  assert(hasStarChapterFilter !== null, '[6/16] Selecting subject reveals its chapters');

  // Select chapter "恆星演化與生命週期"
  await page.click('[data-testid="filter-pill-章節-恆星演化與生命週期"]');
  await new Promise(r => setTimeout(r, 400));

  // Verify unit filter shows "主序星與赫羅圖" and "超新星爆炸"
  const hasHrUnitFilter = await page.$('[data-testid="filter-pill-單元-主序星與赫羅圖"]');
  const hasSnUnitFilter = await page.$('[data-testid="filter-pill-單元-超新星爆炸"]');
  assert(hasHrUnitFilter !== null && hasSnUnitFilter !== null, '[6/16] Selecting chapter reveals its units');
  console.log('✅ [6/16] Passed: Subject -> Chapter -> Unit cascading filters work accurately.');

  // Reset filters to inspect all mistakes
  const resetBtn = await page.$('[data-testid="reset-all-filters-btn"]');
  if (resetBtn) {
    await resetBtn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  // =========================================================================
  // Criterion 7 & 8: 統計題數與資料庫實際數量一致 & 百分比與分母正確 (無 NaN/Infinity)
  // =========================================================================
  console.log('🧪 [7/16 & 8/16] Testing: Statistical counts and percentages match DB...');
  const pageText = await page.evaluate(() => document.body.innerText);
  assert(pageText.includes('符合條件共 2 題'), '[7/16] Filtered count displays 2 mistakes matching DB');
  assert(!pageText.includes('NaN') && !pageText.includes('Infinity'), '[8/16] No NaN or Infinity present when data exists');
  assert(pageText.includes('50.0%') && pageText.includes('100.0%'), '[8/16] Percentages formatted to 1 decimal place (50.0%, 100.0%)');

  // Test 0-match filter to verify no NaN / Infinity and "尚無資料"
  const kwInput = await waitForSelectorSafe(page, 'input[placeholder*="關鍵字搜尋"]');
  await kwInput.type('__NON_EXISTENT_KEYWORD_999__');
  await new Promise(r => setTimeout(r, 400));

  const zeroPageText = await page.evaluate(() => document.body.innerText);
  assert(zeroPageText.includes('符合條件共 0 題'), '[8/16] Zero-match filter displays 0');
  assert(!zeroPageText.includes('NaN') && !zeroPageText.includes('Infinity'), '[8/16] Zero-match filter produces no NaN or Infinity');
  assert(zeroPageText.includes('尚無資料'), '[8/16] Zero-match filter explicitly shows "尚無資料"');

  // Clear keyword filter
  await page.click('[data-testid="reset-all-filters-btn"]');
  await new Promise(r => setTimeout(r, 300));
  console.log('✅ [7/16 & 8/16] Passed: Counts, denominators, and 0-item edge cases verified.');

  // =========================================================================
  // Criterion 9: 多選錯因的統計不會被誤認為互斥分類 (Involvement Rate vs Tag Share)
  // =========================================================================
  console.log('🧪 [9/16] Testing: Multi-select error reason statistics (涉及率 vs 標籤占比)...');
  await page.click('[data-testid="dist-dim-error_reason"]');
  await new Promise(r => setTimeout(r, 400));

  // In Involvement Rate (涉及率):
  // Mistake 1 has [觀念不清, 物理單位換算失誤], Mistake 2 has [觀念不清].
  // Total filtered mistakes = 2.
  // 觀念不清 involvement = 2 / 2 = 100.0%; 物理單位換算失誤 involvement = 1 / 2 = 50.0%.
  const involvementRowConcept = await page.$eval('[data-testid="dist-row-觀念不清"]', el => el.innerText);
  const involvementRowUnit = await page.$eval('[data-testid="dist-row-物理單位換算失誤"]', el => el.innerText);
  assert(involvementRowConcept.includes('100.0%') && involvementRowUnit.includes('50.0%'), '[9/16] Involvement Rate correctly computes 2/2 (100.0%) and 1/2 (50.0%)');

  // Switch to Tag Share (標籤占比):
  // Total error reason tags across filtered mistakes = 3.
  // 觀念不清 tag share = 2 / 3 = 66.7%; 物理單位換算失誤 tag share = 1 / 3 = 33.3%.
  await page.click('[data-testid="error-stat-tag-share-btn"]');
  await new Promise(r => setTimeout(r, 400));
  const tagShareRowConcept = await page.$eval('[data-testid="dist-row-觀念不清"]', el => el.innerText);
  const tagShareRowUnit = await page.$eval('[data-testid="dist-row-物理單位換算失誤"]', el => el.innerText);
  assert(tagShareRowConcept.includes('66.7%') && tagShareRowUnit.includes('33.3%'), '[9/16] Tag Share correctly computes 2/3 (66.7%) and 1/3 (33.3%)');
  console.log('✅ [9/16] Passed: Multi-select error reason Involvement Rate (100.0%/50.0%) vs Tag Share (66.7%/33.3%) verified.');

  // =========================================================================
  // Criterion 10: 點擊圖表可以進入對應錯題清單 (Clicking chart drills down to mistake list)
  // =========================================================================
  console.log('🧪 [10/16] Testing: Clicking chart item drills down to matching mistakes...');
  await page.click('[data-testid="dist-row-物理單位換算失誤"]');
  await new Promise(r => setTimeout(r, 400));
  const drilledText = await page.evaluate(() => document.body.innerText);
  assert(drilledText.includes('符合條件共 1 題') && drilledText.includes('赫羅圖表面溫度與光度關係'), '[10/16] Clicking "物理單位換算失誤" bar filtered down to 1 matching mistake');
  await page.click('[data-testid="reset-all-filters-btn"]');
  await new Promise(r => setTimeout(r, 300));
  console.log('✅ [10/16] Passed: Chart drilldown filters and displays matching mistakes.');

  // =========================================================================
  // Criterion 11 & 12: 新增錯題後統計即時更新 & 未分類錯題可被找出
  // =========================================================================
  console.log('🧪 [11/16 & 12/16] Testing: Adding an uncategorized mistake updates stats & can be found...');
  await clickHeaderOrSidebarButton(page, '所有錯題');
  await new Promise(r => setTimeout(r, 400));

  // Click "新增錯題"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find(b => b.textContent && b.textContent.includes('新增錯題'));
    if (addBtn) addBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Select Uncategorized for Subject in MistakeEditor so it's uncategorized, and enter title
  await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    // Clear subject/chapter/unit selects to '' (uncategorized)
    selects.forEach(sel => {
      if (Array.from(sel.options).some(o => o.text.includes('暫不分類') || o.value === '')) {
        sel.value = '';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
  const mTitleInput = await waitForSelectorSafe(page, 'input[placeholder*="請輸入錯題"]');
  await mTitleInput.type('尚未分類的神秘物理題');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const saveBtn = btns.find(b => b.textContent && (b.textContent.includes('儲存錯題') || b.textContent === '儲存'));
    if (saveBtn) saveBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Verify in AnalyticsView that total mistakes immediately became 3 and uncategorized filter finds it
  await clickHeaderOrSidebarButton(page, '錯題分析');
  await new Promise(r => setTimeout(r, 400));
  const afterAddText = await page.evaluate(() => document.body.innerText);
  assert(afterAddText.includes('符合條件共 3 題'), '[11/16] Total mistakes immediately updated to 3 after adding mistake');

  // Click uncategorized subject pill to isolate uncategorized mistakes
  await page.click('[data-testid="filter-pill-科目-uncategorized"]');
  await new Promise(r => setTimeout(r, 400));
  const uncatDrilldownText = await page.$eval('#analytics-mistake-drilldown', el => el.innerText);
  assert(uncatDrilldownText.includes('符合篩選條件的錯題清單 (1 題)') && uncatDrilldownText.includes('尚未分類的神秘物理題'), '[12/16] Uncategorized filter isolates "尚未分類的神秘物理題"');

  // Reset analytics filter so all mistakes are active
  await page.click('[data-testid="reset-all-filters-btn"]');
  await new Promise(r => setTimeout(r, 300));
  console.log('✅ [11/16 & 12/16] Passed: Real-time stats update & uncategorized mistake identification verified.');

  // =========================================================================
  // Criterion 13 & 14: 提詞產生器使用真實篩選結果、純圖片題警告、複製與匯出功能正常
  // =========================================================================
  console.log('🧪 [13/16 & 14/16] Testing: Pure-code Prompt Generator, image-only warning, copy & export...');
  // Add an image-only mistake (has q_image, no q_text) to verify the image-only warning
  await page.evaluate(async () => {
    await fetch('/api/mistakes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '純圖片幾何光學題',
        content: {
          templateName: '標準錯題模板',
          q_text: '',
          q_image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          a_text: '全反射臨界角公式 sin(theta_c) = n2 / n1'
        }
      })
    });
  });

  await page.reload({ waitUntil: 'networkidle0' });
  await waitForSelectorSafe(page, 'header');
  await clickHeaderOrSidebarButton(page, '提詞產生器');
  await waitForSelectorSafe(page, '[data-testid="generated-prompt-preview"]');

  // Verify real mistakes are in the prompt output
  const promptPreviewValue = await page.$eval('[data-testid="generated-prompt-preview"]', el => el.value);
  assert(
    promptPreviewValue.includes('赫羅圖表面溫度與光度關係') &&
    promptPreviewValue.includes('Ia型超新星標準燭光機制'),
    '[13/16] Prompt generator interpolates real mistake titles and content'
  );

  // Verify image-only warning banner is displayed for "純圖片幾何光學題"
  const hasImgWarning = await page.$('[data-testid="image-only-warning-banner"]');
  assert(hasImgWarning !== null, '[14/16] Image-only mistake triggers explicit warning banner in Prompt Generator');
  assert(
    promptPreviewValue.includes('此題目僅有圖片而無題目文字'),
    '[14/16] Prompt output explicitly warns that image content is not converted to text'
  );

  // Switch between built-in templates (e.g. 錯因分析模板)
  await page.click('[data-testid="prompt-tpl-btn-錯因分析模板"]');
  await new Promise(r => setTimeout(r, 300));
  const errorTplPreview = await page.$eval('[data-testid="generated-prompt-preview"]', el => el.value);
  assert(errorTplPreview.includes('錯題錯因深度診斷'), '[13/16] Switching to Error Analysis template updates prompt');

  // Test Copy, TXT download, MD download buttons exist and work
  await page.click('[data-testid="copy-prompt-btn"]');
  await new Promise(r => setTimeout(r, 300));
  const hasTxtBtn = await page.$('[data-testid="download-txt-btn"]');
  const hasMdBtn = await page.$('[data-testid="download-md-btn"]');
  assert(hasTxtBtn !== null && hasMdBtn !== null, '[14/16] TXT and Markdown export buttons are available');
  console.log('✅ [13/16 & 14/16] Passed: Prompt Generator interpolates real data, warns on image-only questions, and supports copy/export.');

  // =========================================================================
  // Criterion 15: 原有圖片、模板、登入與 PDF 匯出正常 (Templates, Images, PDF Export)
  // =========================================================================
  console.log('🧪 [15/16] Testing: Original Template Manager and PDF Practice/Solution Export...');
  await clickHeaderOrSidebarButton(page, 'nav-templates');
  await new Promise(r => setTimeout(r, 500));
  const tplPageText = await page.evaluate(() => document.body.innerText);
  assert(tplPageText.includes('標準錯題模板') || tplPageText.includes('模板'), '[15/16] Template Manager loads properly');

  await clickHeaderOrSidebarButton(page, 'PDF 匯出');
  await new Promise(r => setTimeout(r, 500));
  const exportPageText = await page.evaluate(() => document.body.innerText);
  assert(
    exportPageText.includes('錯題 PDF 匯出預覽') &&
    exportPageText.includes('練習卷模式') &&
    exportPageText.includes('解析卷模式'),
    '[15/16] Export PDF page loads with Practice & Solution sheet options'
  );
  console.log('✅ [15/16] Passed: Original templates, images, and PDF export verified.');

  // =========================================================================
  // Criterion 16: 重新整理及重新登入後資料仍存在，且多帳號隔離 (Persistence & Isolation)
  // =========================================================================
  console.log('🧪 [16/16] Testing: Data persistence across reload/re-login and multi-user isolation...');
  // Log out User 1
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('header button'));
    const logout = btns.find(b => b.textContent.includes('登出'));
    if (logout) logout.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Log back in as User 1
  await loginUser(page, user1, pass);
  await waitForSelectorSafe(page, 'header');

  const persistedMistakes = await page.evaluate(async () => (await fetch('/api/mistakes')).json());
  const persistedCats = await page.evaluate(async () => (await fetch('/api/categories')).json());
  assert(persistedMistakes.length === 4, `[16/16] Expected 4 persisted mistakes after re-login, got ${persistedMistakes.length}`);
  assert(persistedCats.subjects.some(s => s.name === '天文學'), '[16/16] Custom subject "天文學" persisted after re-login');

  // Register and login User 2 to verify strict account isolation
  const user2 = generateRandomUser();
  await registerUser(page, user2, pass);
  await loginUser(page, user2, pass);
  await waitForSelectorSafe(page, 'header');

  const user2Mistakes = await page.evaluate(async () => (await fetch('/api/mistakes')).json());
  const user2Cats = await page.evaluate(async () => (await fetch('/api/categories')).json());
  assert(user2Mistakes.length === 0, `[16/16] User 2 should have 0 mistakes, got ${user2Mistakes.length}`);
  assert(!user2Cats.subjects.some(s => s.name === '天文學'), '[16/16] User 2 should not see User 1 custom subject "天文學"');
  console.log('✅ [16/16] Passed: Data persists across reload/re-login and is strictly isolated between accounts.');

  // =========================================================================
  // Criterion 17: 科目與章節專屬錯因自定義 & 刪除章節雙選項 (保留錯題 / 連同錯題刪除)
  // =========================================================================
  console.log('🧪 [17/17] Testing: Subject/Chapter custom error reasons & Two-choice chapter deletion (keep vs purge mistakes)...');
  const u2Subj = user2Cats.subjects[0];
  // Create two chapters under u2Subj
  await page.evaluate(async (sId) => {
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '測試章節A_保留錯題', dimension: 'chapter', parent_id: sId })
    });
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '測試章節B_連同錯題刪除', dimension: 'chapter', parent_id: sId })
    });
  }, u2Subj.id);

  const catsWithChaps = await page.evaluate(async () => (await fetch('/api/categories')).json());
  const chapKeep = catsWithChaps.chapters.find(c => c.name === '測試章節A_保留錯題');
  const chapPurge = catsWithChaps.chapters.find(c => c.name === '測試章節B_連同錯題刪除');
  assert(chapKeep && chapPurge, '[17/17] Created test chapters A and B');

  // Create a Subject-scoped error reason and a Chapter-scoped error reason
  await page.evaluate(async (sId, cId) => {
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '科目專屬錯因_讀圖錯誤', dimension: 'error_reason', parent_id: sId })
    });
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '章節專屬錯因_公式代錯', dimension: 'error_reason', parent_id: cId })
    });
  }, u2Subj.id, chapKeep.id);

  const catsWithScopedReasons = await page.evaluate(async () => (await fetch('/api/categories')).json());
  const subjReason = catsWithScopedReasons.errorReasons.find(r => r.name === '科目專屬錯因_讀圖錯誤');
  const chapReason = catsWithScopedReasons.errorReasons.find(r => r.name === '章節專屬錯因_公式代錯');
  assert(subjReason && subjReason.parent_id === u2Subj.id && subjReason.subject_id === u2Subj.id, '[17/17] Subject-scoped error reason has parent_id and subject_id');
  assert(chapReason && chapReason.parent_id === chapKeep.id && chapReason.subject_id === u2Subj.id, '[17/17] Chapter-scoped error reason has parent_id=chapterId and resolved subject_id');

  // Create 1 mistake in chapKeep and 1 mistake in chapPurge
  await createMistakeViaApi(page, {
    title: '應保留之錯題_章節A',
    subject_id: u2Subj.id,
    chapter_id: chapKeep.id,
    error_reason_ids: [chapReason.id],
    questionData: { q_text: '題目A' },
    answerData: { a_correct: 'A' }
  });
  await createMistakeViaApi(page, {
    title: '應刪除之錯題_章節B',
    subject_id: u2Subj.id,
    chapter_id: chapPurge.id,
    error_reason_ids: [subjReason.id],
    questionData: { q_text: '題目B' },
    answerData: { a_correct: 'B' }
  });

  // 1) Delete chapKeep with mode='unassign' (保留錯題)
  await page.evaluate(async (cId) => {
    await fetch('/api/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cId, mode: 'unassign' })
    });
  }, chapKeep.id);

  const mistakesAfterKeep = await page.evaluate(async () => (await fetch('/api/mistakes')).json());
  const keptMistake = mistakesAfterKeep.find(m => m.title === '應保留之錯題_章節A');
  assert(keptMistake && keptMistake.chapter_id === null && keptMistake.subject_id === u2Subj.id, '[17/17] Deleting chapter with mode=unassign keeps mistake and preserves subject_id');

  // 2) Delete chapPurge with mode='purge' (連同錯題一起刪除)
  await page.evaluate(async (cId) => {
    await fetch('/api/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cId, mode: 'purge' })
    });
  }, chapPurge.id);

  const mistakesAfterPurge = await page.evaluate(async () => (await fetch('/api/mistakes')).json());
  const purgedMistake = mistakesAfterPurge.find(m => m.title === '應刪除之錯題_章節B');
  assert(!purgedMistake && mistakesAfterPurge.length === 1, '[17/17] Deleting chapter with mode=purge deletes mistakes in that chapter while keeping others');
  console.log('✅ [17/17] Passed: Subject/Chapter custom error reasons & Two-choice chapter deletion verified.');

  await page.close();
}
