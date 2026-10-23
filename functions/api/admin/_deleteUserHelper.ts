import { ensureSchemaAndUserDefaults } from '../_dbInit';

export async function deleteUserAndData(userId: string, db: D1Database): Promise<void> {
  await ensureSchemaAndUserDefaults(db);

  // 1. Find all mistakes belonging to the user (including uncategorized mistakes)
  const mistakes = await db.prepare(
    `SELECT m.data 
     FROM mistakes m
     LEFT JOIN chapters c ON m.chapter_id = c.id
     LEFT JOIN subjects s ON COALESCE(m.subject_id, c.subject_id) = s.id
     WHERE m.user_id = ? OR s.user_id = ?`
  )
  .bind(userId, userId)
  .all();

  const imageKeys = new Set<string>();
  const uuidImageRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

  function extractImageKeys(val: any): void {
    if (typeof val === 'string') {
      if (uuidImageRegex.test(val)) {
        imageKeys.add(val);
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        extractImageKeys(item);
      }
    } else if (val !== null && typeof val === 'object') {
      for (const key of Object.keys(val)) {
        extractImageKeys(val[key]);
      }
    }
  }

  if (mistakes.results) {
    for (const m of mistakes.results) {
      try {
        const parsed = JSON.parse(m.data as string);
        extractImageKeys(parsed);
      } catch (e) {
        // ignore parsing errors
      }
    }
  }

  // 2. Delete images from 'images' table
  if (imageKeys.size > 0) {
    const keysArray = Array.from(imageKeys);
    for (let i = 0; i < keysArray.length; i += 100) {
      const chunk = keysArray.slice(i, i + 100);
      const placeholders = chunk.map(() => '?').join(',');
      await db.prepare(`DELETE FROM images WHERE key IN (${placeholders})`).bind(...chunk).run();
    }
  }

  // 3. Delete user's mistakes, units, categories, prompt_templates, user_settings, chapters, subjects, templates, feedback
  await db.prepare(
    `DELETE FROM mistakes WHERE user_id = ? OR chapter_id IN (SELECT c.id FROM chapters c JOIN subjects s ON c.subject_id = s.id WHERE s.user_id = ?)`
  ).bind(userId, userId).run();
  await db.prepare(`DELETE FROM units WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM categories WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM prompt_templates WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM user_settings WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM chapters WHERE subject_id IN (SELECT id FROM subjects WHERE user_id = ?)`).bind(userId).run();
  await db.prepare(`DELETE FROM subjects WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM templates WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM feedback WHERE user_id = ?`).bind(userId).run();

  // 4. Delete the user from the 'users' table
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}
