interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string };
}

// GET /api/templates - List all templates for the current user
export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { env, data } = context;
    const userId = data.user!.id;

    const templates = await env.DB.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all();

    let results = templates.results.map((t: any) => ({
      ...t,
      fields: JSON.parse(t.fields)
    }));

    if (results.length === 0) {
      const defaultId = crypto.randomUUID();
      const defaultName = '基礎錯題與掌握度評估';
      const defaultFields = {
        questionFields: [
          { id: 'q_desc', type: 'textarea', label: '題目描述' },
          { id: 'q_img', type: 'image', label: '題目相片' }
        ],
        answerFields: [
          { id: 'a_desc', type: 'textarea', label: '正確答案與詳細解析' },
          {
            id: 'a_timer',
            type: 'text',
            label: '計時',
            styleType: 'underline',
            inline: true,
            hideLabel: false
          },
          {
            id: 'a_mastery',
            type: 'options',
            label: '掌握度',
            options: [
              { value: '順', color: 'success' },
              { value: '卡', color: 'warning' },
              { value: '不會', color: 'danger' },
              { value: '誤解', color: 'danger' }
            ],
            inline: true,
            hideLabel: true
          }
        ]
      };
      
      const now = Date.now();
      await env.DB.prepare('INSERT INTO templates (id, user_id, name, fields, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(defaultId, userId, defaultName, JSON.stringify(defaultFields), now)
        .run();

      results = [{
        id: defaultId,
        user_id: userId,
        name: defaultName,
        fields: defaultFields,
        created_at: now
      }];
    }

    return new Response(JSON.stringify(results), {
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

// POST /api/templates - Create a template
export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const { name, fields } = await request.json() as any;

    if (!name || name.trim() === '' || !fields) {
      return new Response(JSON.stringify({ error: 'Template name and fields are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const fieldsStr = typeof fields === 'string' ? fields : JSON.stringify(fields);

    await env.DB.prepare('INSERT INTO templates (id, user_id, name, fields, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, userId, name.trim(), fieldsStr, now)
      .run();

    return new Response(JSON.stringify({
      success: true,
      template: {
        id,
        name: name.trim(),
        fields: typeof fields === 'string' ? JSON.parse(fields) : fields,
        created_at: now
      }
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

// PUT /api/templates - Update a template
export const onRequestPut: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const { id, name, fields } = await request.json() as any;

    if (!id || !name || name.trim() === '' || !fields) {
      return new Response(JSON.stringify({ error: 'Template id, name, and fields are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fieldsStr = typeof fields === 'string' ? fields : JSON.stringify(fields);

    const result = await env.DB.prepare('UPDATE templates SET name = ?, fields = ? WHERE id = ? AND user_id = ?')
      .bind(name.trim(), fieldsStr, id, userId)
      .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Template not found or access denied.' }), {
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

// DELETE /api/templates?id=xxx - Delete a template
export const onRequestDelete: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Template id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await env.DB.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Template not found or access denied.' }), {
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
