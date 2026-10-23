import { ensureSchemaAndUserDefaults } from './_dbInit';

interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string };
}

// GET /api/subjects - List all subjects for the user
export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const subjects = await env.DB.prepare('SELECT * FROM subjects WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC')
      .bind(userId)
      .all();

    return new Response(JSON.stringify(subjects.results), {
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

// POST /api/subjects - Create a subject
export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const { name, color = 'default' } = await request.json() as any;

    if (!name || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Subject name is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const minRow = await env.DB.prepare('SELECT MIN(sort_order) as min_order FROM subjects WHERE user_id = ?').bind(userId).first() as any;
    const sortOrder = (minRow?.min_order ?? 10) - 1;

    await env.DB.prepare(
      'INSERT INTO subjects (id, user_id, name, color, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
    )
      .bind(id, userId, name.trim(), color, sortOrder, now, now)
      .run();

    return new Response(JSON.stringify({
      success: true,
      subject: { id, name: name.trim(), color, sort_order: sortOrder, is_active: 1, created_at: now, updated_at: now }
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

// PUT /api/subjects - Update a subject
export const onRequestPut: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const { id, name } = await request.json() as any;

    if (!id || !name || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Subject id and name are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Date.now();
    const result = await env.DB.prepare('UPDATE subjects SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .bind(name.trim(), now, id, userId)
      .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Subject not found or access denied.' }), {
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

// DELETE /api/subjects?id=xxx - Delete a subject
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
      return new Response(JSON.stringify({ error: 'Subject id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Date.now();
    if (mode === 'purge') {
      await env.DB.prepare(
        `DELETE FROM mistakes WHERE (subject_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE subject_id = ?)) AND user_id = ?`
      ).bind(id, id, userId).run();
    } else {
      const nextSubj = (mode === 'reassign' && targetId && targetId !== 'uncategorized') ? targetId : null;
      await env.DB.prepare(
        `UPDATE mistakes SET subject_id = ?, chapter_id = NULL, unit_id = NULL, updated_at = ?
         WHERE (subject_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE subject_id = ?)) AND user_id = ?`
      ).bind(nextSubj, now, id, id, userId).run();
    }

    await env.DB.prepare('DELETE FROM units WHERE subject_id = ? AND user_id = ?').bind(id, userId).run();
    await env.DB.prepare('DELETE FROM chapters WHERE subject_id = ?').bind(id).run();
    const result = await env.DB.prepare('DELETE FROM subjects WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Subject not found or access denied.' }), {
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
