let schemaChecked = false;

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
