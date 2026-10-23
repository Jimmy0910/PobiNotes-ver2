import { ensureSchemaAndUserDefaults } from './_dbInit';

interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string };
}

// GET /api/chapters?subjectId=xxx - List all chapters for a specific subject (or all chapters for user if subjectId omitted)
export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const url = new URL(request.url);
    const subjectId = url.searchParams.get('subjectId');

    if (!subjectId) {
      const allChapters = await env.DB.prepare(
        `SELECT c.* FROM chapters c 
         JOIN subjects s ON c.subject_id = s.id 
         WHERE s.user_id = ? 
         ORDER BY c.sort_order ASC, c.created_at ASC`
      )
      .bind(userId)
      .all();

      return new Response(JSON.stringify(allChapters.results), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const chapters = await env.DB.prepare(
      `SELECT c.* FROM chapters c 
       JOIN subjects s ON c.subject_id = s.id 
       WHERE c.subject_id = ? AND s.user_id = ? 
       ORDER BY c.sort_order ASC, c.created_at ASC`
    )
    .bind(subjectId, userId)
    .all();

    return new Response(JSON.stringify(chapters.results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST /api/chapters - Create a chapter under a subject (with ownership check)
export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const { name, subjectId, color = 'default' } = await request.json() as any;

    if (!name || name.trim() === '' || !subjectId) {
      return new Response(JSON.stringify({ error: 'Chapter name and subjectId are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify subject ownership
    const subject = await env.DB.prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?')
      .bind(subjectId, userId)
      .first();

    if (!subject) {
      return new Response(JSON.stringify({ error: 'Subject not found or access denied.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const maxRow = await env.DB.prepare('SELECT MAX(sort_order) as max_order FROM chapters WHERE subject_id = ?').bind(subjectId).first() as any;
    const sortOrder = (maxRow?.max_order ?? 0) + 10;

    await env.DB.prepare(
      'INSERT INTO chapters (id, subject_id, name, color, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
    )
      .bind(id, subjectId, name.trim(), color, sortOrder, now, now)
      .run();

    return new Response(JSON.stringify({
      success: true,
      chapter: { id, subject_id: subjectId, name: name.trim(), color, sort_order: sortOrder, is_active: 1, created_at: now, updated_at: now }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT /api/chapters - Update a chapter name (with ownership check)
export const onRequestPut: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const { id, name } = await request.json() as any;

    if (!id || !name || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Chapter id and name are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Date.now();
    const result = await env.DB.prepare(
      `UPDATE chapters 
       SET name = ?, updated_at = ? 
       WHERE id = ? 
       AND EXISTS (
         SELECT 1 FROM subjects s 
         WHERE s.id = chapters.subject_id 
         AND s.user_id = ?
       )`
    )
    .bind(name.trim(), now, id, userId)
    .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Chapter not found or access denied.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE /api/chapters?id=xxx - Delete a chapter (with ownership check)
export const onRequestDelete: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const mode = url.searchParams.get('mode') || 'unassign';
    const targetId = url.searchParams.get('targetId') || null;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Chapter id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Date.now();
    const chapInfo = await env.DB.prepare(`SELECT subject_id FROM chapters WHERE id = ?`).bind(id).first() as any;
    const chapSubjectId = chapInfo?.subject_id || null;

    if (mode === 'purge') {
      await env.DB.prepare(`DELETE FROM mistakes WHERE chapter_id = ? AND (user_id = ? OR user_id IS NULL)`).bind(id, userId).run();
    } else if (mode === 'reassign' && targetId && targetId !== 'uncategorized') {
      const targetChap = await env.DB.prepare(`SELECT subject_id FROM chapters WHERE id = ?`).bind(targetId).first() as any;
      await env.DB.prepare(
        `UPDATE mistakes SET subject_id = ?, chapter_id = ?, unit_id = NULL, updated_at = ? WHERE chapter_id = ? AND (user_id = ? OR user_id IS NULL)`
      ).bind(targetChap?.subject_id || chapSubjectId, targetId, now, id, userId).run();
    } else {
      await env.DB.prepare(
        `UPDATE mistakes SET subject_id = COALESCE(subject_id, ?), chapter_id = NULL, unit_id = NULL, updated_at = ? WHERE chapter_id = ? AND (user_id = ? OR user_id IS NULL)`
      ).bind(chapSubjectId, now, id, userId).run();
    }

    await env.DB.prepare('UPDATE categories SET parent_id = ?, updated_at = ? WHERE parent_id = ? AND user_id = ?').bind(chapSubjectId, now, id, userId).run();
    await env.DB.prepare('DELETE FROM units WHERE chapter_id = ? AND user_id = ?').bind(id, userId).run();

    const result = await env.DB.prepare(
      `DELETE FROM chapters 
       WHERE id = ? 
       AND EXISTS (
         SELECT 1 FROM subjects s 
         WHERE s.id = chapters.subject_id 
         AND s.user_id = ?
       )`
    )
    .bind(id, userId)
    .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Chapter not found or access denied.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
