import { ensureSchemaAndUserDefaults } from './_dbInit';

interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string };
}

// GET /api/prompt-templates - Fetch user's custom/modified prompt templates (Copy-on-Write from D1)
export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const rows = await env.DB.prepare(
      `SELECT * FROM prompt_templates WHERE user_id = ? ORDER BY updated_at DESC`
    ).bind(userId).all();

    return new Response(JSON.stringify(rows.results || []), {
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

// POST /api/prompt-templates - Save a new custom prompt template or override a built-in template
export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const { baseKey, name, description = '', content } = await request.json() as any;
    if (!name || !name.trim() || !content || !content.trim()) {
      return new Response(JSON.stringify({ error: '模板名稱與提詞內容為必填' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Date.now();

    // If overriding a built-in baseKey, update existing override if present
    if (baseKey) {
      const existing = await env.DB.prepare(
        `SELECT id FROM prompt_templates WHERE user_id = ? AND base_key = ?`
      ).bind(userId, baseKey).first() as any;

      if (existing) {
        await env.DB.prepare(
          `UPDATE prompt_templates SET name = ?, description = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?`
        ).bind(name.trim(), description, content, now, existing.id, userId).run();

        return new Response(JSON.stringify({
          success: true,
          template: { id: existing.id, user_id: userId, base_key: baseKey, name: name.trim(), description, content, updated_at: now }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO prompt_templates (id, user_id, base_key, name, description, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, userId, baseKey || null, name.trim(), description, content, now, now).run();

    return new Response(JSON.stringify({
      success: true,
      template: { id, user_id: userId, base_key: baseKey || null, name: name.trim(), description, content, created_at: now, updated_at: now }
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT /api/prompt-templates - Update an existing custom prompt template
export const onRequestPut: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const { id, name, description = '', content } = await request.json() as any;
    if (!id || !name || !name.trim() || !content || !content.trim()) {
      return new Response(JSON.stringify({ error: 'id、模板名稱與提詞內容為必填' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Date.now();
    const res = await env.DB.prepare(
      `UPDATE prompt_templates SET name = ?, description = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?`
    ).bind(name.trim(), description, content, now, id, userId).run();

    if (res.meta.changes === 0) {
      return new Response(JSON.stringify({ error: '找不到該提詞模板或無權限' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE /api/prompt-templates?id=xxx - Delete a custom prompt template (or reset built-in override)
export const onRequestDelete: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'id is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await env.DB.prepare(`DELETE FROM prompt_templates WHERE id = ? AND user_id = ?`).bind(id, userId).run();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
