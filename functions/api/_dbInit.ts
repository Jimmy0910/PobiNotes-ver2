let schemaChecked = false;

export function isMasteryField(f: any): boolean {
  if (!f || typeof f !== 'object') return false;
  const idLower = String(f.id || '').toLowerCase();
  const label = String(f.label || '');
  if (
    idLower === 'a_mastery' ||
    idLower.includes('mastery') ||
    idLower.includes('fam') ||
    label.includes('掌握') ||
    label.includes('熟悉') ||
    label.includes('熟練') ||
    label.includes('難易')
  ) {
    return true;
  }
  if (
    Array.isArray(f.options) &&
    f.options.length > 0 &&
    f.options.some((o: any) =>
      ['順', '卡', '不會', '誤解', '會'].includes(
        typeof o === 'string' ? o.trim() : String(o?.value || '').trim()
      )
    )
  ) {
    return true;
  }
  return false;
}

// Intelligent self-healing function to extract familiarity from answerData, backfill 4.熟悉度, and delete mastery fields from templates & mistakes
export async function healMistakeFamiliarities(db: D1Database, userId: string): Promise<void> {
  try {
    // 1. Fetch user familiarities and enforce EXACTLY the 4 standard ones: 順, 卡, 不會, 誤解
    const famsRes = await db.prepare(
      `SELECT id, name FROM categories WHERE user_id = ? AND dimension = 'familiarity'`
    ).bind(userId).all();

    const standardNames = ['順', '卡', '不會', '誤解'];
    const famNameToId: Record<string, string> = {};
    const nonStandardFams: Array<{ id: string; name: string }> = [];

    for (const f of (famsRes.results || []) as any[]) {
      if (standardNames.includes(f.name)) {
        famNameToId[f.name] = f.id;
      } else {
        nonStandardFams.push({ id: f.id, name: f.name });
      }
    }

    // Ensure all 4 standard familiarities exist
    const defaultFamiliarity = [
      { name: '順', color: 'success', order: 10 },
      { name: '卡', color: 'warning', order: 20 },
      { name: '不會', color: 'danger', order: 30 },
      { name: '誤解', color: 'danger', order: 40 }
    ];
    const now = Date.now();
    for (const item of defaultFamiliarity) {
      if (!famNameToId[item.name]) {
        const id = crypto.randomUUID();
        famNameToId[item.name] = id;
        await db.prepare(
          `INSERT INTO categories (id, user_id, dimension, parent_id, name, color, sort_order, is_active, created_at, updated_at)
           VALUES (?, ?, 'familiarity', NULL, ?, ?, ?, 1, ?, ?)`
        ).bind(id, userId, item.name, item.color, item.order, now, now).run();
      }
    }

    // Clean up non-standard familiarities and reassign mistakes
    if (nonStandardFams.length > 0) {
      for (const nonStd of nonStandardFams) {
        const targetId = (nonStd.name.includes('精通') || nonStd.name.includes('熟') || nonStd.name.includes('會'))
          ? famNameToId['順']
          : famNameToId['卡'];
        await db.prepare(
          `UPDATE mistakes SET familiarity_id = ? WHERE familiarity_id = ? AND user_id = ?`
        ).bind(targetId, nonStd.id, userId).run();
        await db.prepare(
          `DELETE FROM categories WHERE id = ? AND user_id = ?`
        ).bind(nonStd.id, userId).run();
      }
    }

    if (famNameToId['順'] && !famNameToId['會']) {
      famNameToId['會'] = famNameToId['順'];
    }

    // 2. Discover custom mastery/familiarity field IDs from all templates FIRST (before stripping them)
    const tplsRes = await db.prepare(`SELECT id, fields FROM templates WHERE user_id = ?`).bind(userId).all();
    const customFamFieldIds = new Set<string>(['a_mastery']);
    const templatesToUpdate: Array<{ id: string; fieldsJson: string }> = [];

    for (const t of (tplsRes.results || []) as any[]) {
      try {
        const fields = JSON.parse(t.fields || '{}');
        const allFields = [...(fields.questionFields || []), ...(fields.answerFields || [])];
        for (const f of allFields) {
          if (isMasteryField(f) && f.id) {
            customFamFieldIds.add(f.id);
          }
        }

        let changed = false;
        if (Array.isArray(fields.answerFields)) {
          const origLen = fields.answerFields.length;
          fields.answerFields = fields.answerFields.filter((f: any) => !isMasteryField(f));
          if (fields.answerFields.length !== origLen) changed = true;
        }
        if (Array.isArray(fields.questionFields)) {
          const origLen = fields.questionFields.length;
          fields.questionFields = fields.questionFields.filter((f: any) => !isMasteryField(f));
          if (fields.questionFields.length !== origLen) changed = true;
        }
        if (changed) {
          templatesToUpdate.push({ id: t.id, fieldsJson: JSON.stringify(fields) });
        }
      } catch {}
    }

    // 3. Query all mistakes that belong to this user or are linked through chapters/subjects
    const mistakesToRepair = await db.prepare(`
      SELECT m.id, m.user_id, m.subject_id, m.chapter_id, m.familiarity_id, m.template_id, m.data, c.subject_id as chap_subject_id
      FROM mistakes m
      LEFT JOIN chapters c ON m.chapter_id = c.id
      LEFT JOIN subjects s ON COALESCE(m.subject_id, c.subject_id) = s.id
      WHERE (m.user_id = ? OR s.user_id = ? OR m.user_id IS NULL)
    `).bind(userId, userId).all();

    for (const m of (mistakesToRepair.results || []) as any[]) {
      let targetFamId = m.familiarity_id;
      let newDataStr: string | null = null;
      let dataModified = false;

      if (m.data) {
        try {
          const parsed = JSON.parse(m.data);
          const sections = [parsed.answerData, parsed.questionData, parsed];
          let foundName: string | null = null;
          const keysToRemoveFromAnswer = new Set<string>(customFamFieldIds);

          // Step A: Check known mastery template field IDs
          for (const sec of sections) {
            if (sec && typeof sec === 'object') {
              for (const fid of customFamFieldIds) {
                if (sec[fid] !== undefined) {
                  const val = sec[fid];
                  if (typeof val === 'string' && famNameToId[val.trim()]) {
                    foundName = val.trim();
                    break;
                  } else if (Array.isArray(val)) {
                    for (const item of val) {
                      if (typeof item === 'string' && famNameToId[item.trim()]) {
                        foundName = item.trim();
                        break;
                      }
                    }
                  }
                }
              }
              if (foundName) break;
            }
          }

          // Step B: Check keys containing mastery / fam / 掌握 / 熟悉
          if (!foundName) {
            for (const sec of sections) {
              if (sec && typeof sec === 'object') {
                for (const [k, v] of Object.entries(sec)) {
                  const kLower = k.toLowerCase();
                  if (kLower.includes('mastery') || kLower.includes('fam') || k.includes('掌握') || k.includes('熟悉')) {
                    keysToRemoveFromAnswer.add(k);
                    if (typeof v === 'string' && famNameToId[v.trim()]) {
                      foundName = v.trim();
                      break;
                    } else if (Array.isArray(v)) {
                      for (const item of v) {
                        if (typeof item === 'string' && famNameToId[item.trim()]) {
                          foundName = item.trim();
                          break;
                        }
                      }
                    }
                  }
                }
                if (foundName) break;
              }
            }
          }

          // Step C: Scan all entries in answerData / root for any value matching 順 / 卡 / 不會 / 誤解 / 會
          for (const sec of [parsed.answerData, parsed]) {
            if (sec && typeof sec === 'object') {
              for (const [k, v] of Object.entries(sec)) {
                if (k === 'questionData' || k === 'answerData' || k === 'templateName') continue;
                if (typeof v === 'string' && famNameToId[v.trim()]) {
                  if (!foundName) foundName = v.trim();
                  keysToRemoveFromAnswer.add(k);
                } else if (Array.isArray(v) && v.length > 0 && v.every((item: any) => typeof item === 'string' && famNameToId[item.trim()])) {
                  if (!foundName) foundName = v[0].trim();
                  keysToRemoveFromAnswer.add(k);
                }
              }
            }
          }

          if (foundName) {
            targetFamId = famNameToId[foundName] || (foundName === '會' ? famNameToId['順'] : targetFamId);
          }

          // Strip all mastery fields from answerData and root data
          if (parsed && typeof parsed === 'object') {
            for (const rmKey of keysToRemoveFromAnswer) {
              if (parsed.answerData && typeof parsed.answerData === 'object' && parsed.answerData[rmKey] !== undefined) {
                delete parsed.answerData[rmKey];
                dataModified = true;
              }
              if (parsed.questionData && typeof parsed.questionData === 'object' && parsed.questionData[rmKey] !== undefined) {
                delete parsed.questionData[rmKey];
                dataModified = true;
              }
              if (parsed[rmKey] !== undefined) {
                delete parsed[rmKey];
                dataModified = true;
              }
            }
            if (dataModified) {
              newDataStr = JSON.stringify(parsed);
            }
          }
        } catch {}
      }

      const nextSubjectId = m.subject_id || m.chap_subject_id || null;
      const effectiveFamId = targetFamId || m.familiarity_id || null;
      if (m.user_id !== userId || m.subject_id !== nextSubjectId || m.familiarity_id !== effectiveFamId || newDataStr) {
        await db.prepare(
          `UPDATE mistakes
           SET user_id = ?,
               subject_id = COALESCE(subject_id, ?),
               familiarity_id = ?,
               data = COALESCE(?, data)
           WHERE id = ?`
        ).bind(userId, nextSubjectId, effectiveFamId, newDataStr, m.id).run();
      }
    }

    // 4. Finally update templates in DB after all mistake mastery values have been extracted
    for (const tplUpd of templatesToUpdate) {
      await db.prepare(`UPDATE templates SET fields = ? WHERE id = ?`)
        .bind(tplUpd.fieldsJson, tplUpd.id)
        .run();
    }
  } catch (e) {
    console.error('Error in healMistakeFamiliarities:', e);
  }
}

export async function ensureSchemaAndUserDefaults(db: D1Database, userId?: string): Promise<void> {
  if (!schemaChecked) {
    // 1. Create new tables if they don't exist
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        categories_seeded INTEGER DEFAULT 0,
        error_reason_mode TEXT DEFAULT 'multi',
        updated_at INTEGER NOT NULL
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT 'default',
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT 0
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        dimension TEXT NOT NULL,
        parent_id TEXT,
        name TEXT NOT NULL,
        color TEXT DEFAULT 'default',
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT 0
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        base_key TEXT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `).run();

    // 2. Check and add columns on subjects & chapters if migrating from old DB
    const subjectCols = await db.prepare(`PRAGMA table_info(subjects)`).all();
    const subjectColNames = new Set((subjectCols.results || []).map((c: any) => c.name));
    if (!subjectColNames.has('color')) {
      try { await db.prepare(`ALTER TABLE subjects ADD COLUMN color TEXT DEFAULT 'default'`).run(); } catch {}
    }
    if (!subjectColNames.has('sort_order')) {
      try { await db.prepare(`ALTER TABLE subjects ADD COLUMN sort_order INTEGER DEFAULT 0`).run(); } catch {}
    }
    if (!subjectColNames.has('is_active')) {
      try { await db.prepare(`ALTER TABLE subjects ADD COLUMN is_active INTEGER DEFAULT 1`).run(); } catch {}
    }
    if (!subjectColNames.has('updated_at')) {
      try { await db.prepare(`ALTER TABLE subjects ADD COLUMN updated_at INTEGER DEFAULT 0`).run(); } catch {}
      try { await db.prepare(`UPDATE subjects SET updated_at = created_at WHERE updated_at = 0`).run(); } catch {}
    }

    const chapterCols = await db.prepare(`PRAGMA table_info(chapters)`).all();
    const chapterColNames = new Set((chapterCols.results || []).map((c: any) => c.name));
    if (!chapterColNames.has('color')) {
      try { await db.prepare(`ALTER TABLE chapters ADD COLUMN color TEXT DEFAULT 'default'`).run(); } catch {}
    }
    if (!chapterColNames.has('sort_order')) {
      try { await db.prepare(`ALTER TABLE chapters ADD COLUMN sort_order INTEGER DEFAULT 0`).run(); } catch {}
    }
    if (!chapterColNames.has('is_active')) {
      try { await db.prepare(`ALTER TABLE chapters ADD COLUMN is_active INTEGER DEFAULT 1`).run(); } catch {}
    }
    if (!chapterColNames.has('updated_at')) {
      try { await db.prepare(`ALTER TABLE chapters ADD COLUMN updated_at INTEGER DEFAULT 0`).run(); } catch {}
      try { await db.prepare(`UPDATE chapters SET updated_at = created_at WHERE updated_at = 0`).run(); } catch {}
    }

    // 3. Check mistakes table columns & NOT NULL constraint on chapter_id
    const mistakeCols = await db.prepare(`PRAGMA table_info(mistakes)`).all();
    const mistakeColMap = new Map<string, any>();
    for (const c of (mistakeCols.results || []) as any[]) {
      mistakeColMap.set(c.name, c);
    }

    const chapterCol = mistakeColMap.get('chapter_id');
    const needsMistakeRebuild = !mistakeColMap.has('user_id') || (chapterCol && chapterCol.notnull === 1);

    if (needsMistakeRebuild) {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS mistakes_new (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          subject_id TEXT,
          chapter_id TEXT,
          unit_id TEXT,
          familiarity_id TEXT,
          error_reason_ids TEXT DEFAULT '[]',
          tags TEXT DEFAULT '[]',
          mistake_date TEXT,
          template_id TEXT NOT NULL,
          title TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `).run();

      // Copy existing mistakes and backfill user_id & subject_id from chapters/subjects
      await db.prepare(`
        INSERT INTO mistakes_new (id, user_id, subject_id, chapter_id, unit_id, familiarity_id, error_reason_ids, tags, mistake_date, template_id, title, data, created_at, updated_at)
        SELECT
          m.id,
          s.user_id,
          c.subject_id,
          m.chapter_id,
          NULL,
          NULL,
          '[]',
          '[]',
          strftime('%Y-%m-%d', datetime(m.created_at / 1000, 'unixepoch')),
          m.template_id,
          m.title,
          m.data,
          m.created_at,
          m.updated_at
        FROM mistakes m
        LEFT JOIN chapters c ON m.chapter_id = c.id
        LEFT JOIN subjects s ON c.subject_id = s.id
      `).run();

      await db.prepare(`DROP TABLE mistakes`).run();
      await db.prepare(`ALTER TABLE mistakes_new RENAME TO mistakes`).run();
    }

    schemaChecked = true;
  }

  // 4. Seed initial user categories & migrate legacy mastery values if needed
  if (userId) {
    // Run self-healing routine on every user request to guarantee all subjects have familiarity linked
    await healMistakeFamiliarities(db, userId);
    // Auto deduplicate and merge duplicate categories for this user (e.g. repeated familiarity or error reasons)
    try {
      const userCats = await db.prepare(
        `SELECT id, user_id, dimension, parent_id, name, created_at FROM categories WHERE user_id = ? ORDER BY created_at ASC`
      ).bind(userId).all();

      const catMap = new Map<string, any[]>();
      for (const c of (userCats.results || []) as any[]) {
        const key = `${c.dimension}:::${c.parent_id || ''}:::${c.name}`;
        if (!catMap.has(key)) catMap.set(key, []);
        catMap.get(key)!.push(c);
      }

      for (const [, items] of catMap.entries()) {
        if (items.length > 1) {
          const canonical = items[0];
          const duplicates = items.slice(1);
          for (const dup of duplicates) {
            if (canonical.dimension === 'familiarity') {
              await db.prepare(
                `UPDATE mistakes SET familiarity_id = ? WHERE user_id = ? AND familiarity_id = ?`
              ).bind(canonical.id, userId, dup.id).run();
            } else if (canonical.dimension === 'unit') {
              await db.prepare(
                `UPDATE mistakes SET unit_id = ? WHERE user_id = ? AND unit_id = ?`
              ).bind(canonical.id, userId, dup.id).run();
            } else if (canonical.dimension === 'error_reason') {
              const affectedMistakes = await db.prepare(
                `SELECT id, error_reason_ids FROM mistakes WHERE user_id = ? AND error_reason_ids LIKE ?`
              ).bind(userId, `%${dup.id}%`).all();
              for (const m of (affectedMistakes.results || []) as any[]) {
                try {
                  let ids: string[] = JSON.parse(m.error_reason_ids || '[]');
                  ids = ids.map(id => (id === dup.id ? canonical.id : id));
                  ids = Array.from(new Set(ids));
                  await db.prepare(
                    `UPDATE mistakes SET error_reason_ids = ? WHERE id = ?`
                  ).bind(JSON.stringify(ids), m.id).run();
                } catch {}
              }
            }
            await db.prepare(`DELETE FROM categories WHERE id = ?`).bind(dup.id).run();
          }
        }
      }
    } catch (e) {
      console.error('Error during categories deduplication:', e);
    }

    const settings = await db.prepare(`SELECT * FROM user_settings WHERE user_id = ?`).bind(userId).first() as any;
    if (!settings || !settings.categories_seeded) {
      const now = Date.now();

      // Check existing subjects for this user
      const existingSubjects = await db.prepare(`SELECT id, name FROM subjects WHERE user_id = ?`).bind(userId).all();
      if (!existingSubjects.results || existingSubjects.results.length === 0) {
        const defaultSubjects = ['生物', '地球科學', '數學', '物理', '化學'];
        for (let i = 0; i < defaultSubjects.length; i++) {
          await db.prepare(
            `INSERT INTO subjects (id, user_id, name, color, sort_order, is_active, created_at, updated_at)
             VALUES (?, ?, ?, 'default', ?, 1, ?, ?)`
          )
          .bind(crypto.randomUUID(), userId, defaultSubjects[i], (i + 1) * 10, now, now)
          .run();
        }
      }

      // Check existing familiarity items for this user
      const existingFam = await db.prepare(
        `SELECT id, name FROM categories WHERE user_id = ? AND dimension = 'familiarity'`
      ).bind(userId).all();

      const famNameToId: Record<string, string> = {};
      if (!existingFam.results || existingFam.results.length === 0) {
        const defaultFamiliarity = [
          { name: '順', color: 'success', order: 10 },
          { name: '卡', color: 'warning', order: 20 },
          { name: '不會', color: 'danger', order: 30 },
          { name: '誤解', color: 'danger', order: 40 }
        ];
        for (const item of defaultFamiliarity) {
          const id = crypto.randomUUID();
          famNameToId[item.name] = id;
          await db.prepare(
            `INSERT INTO categories (id, user_id, dimension, parent_id, name, color, sort_order, is_active, created_at, updated_at)
             VALUES (?, ?, 'familiarity', NULL, ?, ?, ?, 1, ?, ?)`
          )
          .bind(id, userId, item.name, item.color, item.order, now, now)
          .run();
        }
      } else {
        for (const row of existingFam.results as any[]) {
          famNameToId[row.name] = row.id;
        }
      }

      // Check existing error_reason items for this user
      const existingReasons = await db.prepare(
        `SELECT id, name FROM categories WHERE user_id = ? AND dimension = 'error_reason'`
      ).bind(userId).all();

      if (!existingReasons.results || existingReasons.results.length === 0) {
        const defaultReasons = [
          { name: '觀念不清', color: 'danger', order: 10 },
          { name: '圖表判讀錯誤', color: 'warning', order: 20 },
          { name: '忽略題目條件', color: 'warning', order: 30 },
          { name: '計算粗心', color: 'default', order: 40 },
          { name: '記憶模糊', color: 'default', order: 50 }
        ];
        for (const item of defaultReasons) {
          await db.prepare(
            `INSERT INTO categories (id, user_id, dimension, parent_id, name, color, sort_order, is_active, created_at, updated_at)
             VALUES (?, ?, 'error_reason', NULL, ?, ?, ?, 1, ?, ?)`
          )
          .bind(crypto.randomUUID(), userId, item.name, item.color, item.order, now, now)
          .run();
        }
      }

      // Backfill legacy mistakes (user_id, subject_id, familiarity_id from template data)
      const userMistakes = await db.prepare(
        `SELECT m.id, m.user_id, m.subject_id, m.chapter_id, m.familiarity_id, m.data, c.subject_id as chap_subject_id
         FROM mistakes m
         LEFT JOIN chapters c ON m.chapter_id = c.id
         LEFT JOIN subjects s ON c.subject_id = s.id
         WHERE m.user_id = ? OR s.user_id = ?`
      ).bind(userId, userId).all();

      for (const m of (userMistakes.results || []) as any[]) {
        let nextFamId = m.familiarity_id;
        if (!nextFamId && m.data) {
          try {
            const parsed = JSON.parse(m.data);
            const allValues: string[] = [];
            for (const sec of [parsed.answerData, parsed.questionData]) {
              if (sec && typeof sec === 'object') {
                for (const [k, v] of Object.entries(sec)) {
                  if (k.includes('mastery') && Array.isArray(v)) {
                    allValues.push(...(v as string[]));
                  }
                }
              }
            }
            for (const val of allValues) {
              if ((val === '順' || val === '會') && famNameToId['順']) {
                nextFamId = famNameToId['順'];
                break;
              } else if (famNameToId[val]) {
                nextFamId = famNameToId[val];
                break;
              }
            }
          } catch {}
        }

        const nextSubjectId = m.subject_id || m.chap_subject_id || null;
        if (m.user_id !== userId || m.subject_id !== nextSubjectId || m.familiarity_id !== nextFamId) {
          await db.prepare(
            `UPDATE mistakes SET user_id = ?, subject_id = ?, familiarity_id = ? WHERE id = ?`
          ).bind(userId, nextSubjectId, nextFamId || null, m.id).run();
        }
      }

      await db.prepare(
        `INSERT INTO user_settings (user_id, categories_seeded, error_reason_mode, updated_at)
         VALUES (?, 1, 'multi', ?)
         ON CONFLICT(user_id) DO UPDATE SET categories_seeded = 1, updated_at = excluded.updated_at`
      ).bind(userId, now).run();
    }
  }
}
