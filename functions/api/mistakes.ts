import { ensureSchemaAndUserDefaults } from './_dbInit';

interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string };
}

// Helper to smartly extract familiarity ID from mistakeData across all subject templates
async function resolveFamiliarityIdFromData(
  db: D1Database,
  userId: string,
  explicitFamId: string | null | undefined,
  mistakeData: any
): Promise<string | null> {
  if (explicitFamId) return explicitFamId;
  if (!mistakeData) return null;

  try {
    const famsRes = await db.prepare(
      `SELECT id, name FROM categories WHERE user_id = ? AND dimension = 'familiarity'`
    ).bind(userId).all();
    const famMap = new Map<string, string>();
    for (const f of (famsRes.results || []) as any[]) {
      famMap.set(f.name, f.id);
    }
    if (famMap.has('順') && !famMap.has('會')) {
      famMap.set('會', famMap.get('順')!);
    }

    const parsed = typeof mistakeData === 'string' ? JSON.parse(mistakeData) : mistakeData;
    const sections = [parsed.answerData, parsed.questionData, parsed];

    const matchVal = (v: any): string | null => {
      if (typeof v === 'string' && famMap.has(v.trim())) {
        return famMap.get(v.trim())!;
      }
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string' && famMap.has(item.trim())) {
            return famMap.get(item.trim())!;
          }
        }
      }
      if (v && typeof v === 'object' && typeof v.value === 'string' && famMap.has(v.value.trim())) {
        return famMap.get(v.value.trim())!;
      }
      return null;
    };

    // 1. Check keys related to mastery or familiarity
    for (const sec of sections) {
      if (sec && typeof sec === 'object') {
        for (const [k, v] of Object.entries(sec)) {
          const kLower = k.toLowerCase();
          if (kLower.includes('mastery') || kLower.includes('fam') || k.includes('掌握') || k.includes('熟悉') || k.includes('難易')) {
            const m = matchVal(v);
            if (m) return m;
          }
        }
      }
    }

    // 2. Scan all entries for any standard familiarity value
    for (const sec of sections) {
      if (sec && typeof sec === 'object') {
        for (const [, v] of Object.entries(sec)) {
          const m = matchVal(v);
          if (m) return m;
        }
      }
    }
  } catch {}

  return null;
}

// GET /api/mistakes - List mistakes for the user (including uncategorized mistakes)
export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const url = new URL(request.url);
    const chapterId = url.searchParams.get('chapterId');
    const subjectId = url.searchParams.get('subjectId');
    const unitId = url.searchParams.get('unitId');

    // Fetch error reason categories for this user to resolve names by stable ID
    const reasonsRes = await env.DB.prepare(
      `SELECT id, name, color, is_active FROM categories WHERE user_id = ? AND dimension = 'error_reason'`
    ).bind(userId).all();
    const reasonMap = new Map<string, { id: string; name: string; color: string; is_active: number }>();
    for (const r of (reasonsRes.results || []) as any[]) {
      reasonMap.set(r.id, r);
    }

    // Fetch familiarities for this user
    const famsRes = await env.DB.prepare(
      `SELECT id, name, color, is_active FROM categories WHERE user_id = ? AND dimension = 'familiarity'`
    ).bind(userId).all();
    const famMap = new Map<string, { id: string; name: string; color: string; is_active: number }>();
    const famNameToObj = new Map<string, { id: string; name: string; color: string; is_active: number }>();
    for (const f of (famsRes.results || []) as any[]) {
      famMap.set(f.id, f);
      famNameToObj.set(f.name, f);
    }
    if (famNameToObj.has('順') && !famNameToObj.has('會')) {
      famNameToObj.set('會', famNameToObj.get('順')!);
    }

    let query = `
      SELECT
        m.*,
        COALESCE(m.subject_id, c.subject_id) as effective_subject_id,
        s.name as subject_name,
        s.is_active as subject_is_active,
        c.name as chapter_name,
        c.is_active as chapter_is_active,
        u.name as unit_name,
        u.is_active as unit_is_active,
        f.name as familiarity_name,
        f.color as familiarity_color,
        f.is_active as familiarity_is_active,
        t.name as template_name,
        t.fields as template_fields
      FROM mistakes m
      LEFT JOIN chapters c ON m.chapter_id = c.id
      LEFT JOIN subjects s ON COALESCE(m.subject_id, c.subject_id) = s.id
      LEFT JOIN units u ON m.unit_id = u.id
      LEFT JOIN categories f ON m.familiarity_id = f.id
      LEFT JOIN templates t ON m.template_id = t.id
      WHERE (m.user_id = ? OR s.user_id = ?)
    `;
    const params: any[] = [userId, userId];

    if (unitId) {
      query += ` AND m.unit_id = ?`;
      params.push(unitId);
    } else if (chapterId) {
      query += ` AND m.chapter_id = ?`;
      params.push(chapterId);
    } else if (subjectId) {
      query += ` AND COALESCE(m.subject_id, c.subject_id) = ?`;
      params.push(subjectId);
    }

    query += ` ORDER BY m.created_at DESC`;

    const mistakes = await env.DB.prepare(query).bind(...params).all();

    const defaultTemplateFields = {
      questionFields: [
        { id: 'q_desc', type: 'textarea', label: '題目描述' },
        { id: 'q_img', type: 'image', label: '題目相片' }
      ],
      answerFields: [
        { id: 'a_desc', type: 'textarea', label: '正確答案與詳細解析' }
      ]
    };

    const results = (mistakes.results || []).map((m: any) => {
      let parsedData = { questionData: {}, answerData: {} };
      try {
        parsedData = m.data ? JSON.parse(m.data) : { questionData: {}, answerData: {} };
      } catch {}

      let parsedTemplateFields = defaultTemplateFields;
      try {
        if (m.template_fields) {
          parsedTemplateFields = JSON.parse(m.template_fields);
        }
      } catch {}

      let errorReasonIds: string[] = [];
      try {
        const parsedIds = JSON.parse(m.error_reason_ids || '[]');
        if (Array.isArray(parsedIds)) {
          errorReasonIds = parsedIds.filter((id: string) => reasonMap.has(id));
        }
      } catch {}

      const errorReasonItems = errorReasonIds
        .map(id => reasonMap.get(id))
        .filter(Boolean);

      let tags: string[] = [];
      try {
        const parsedTags = JSON.parse(m.tags || '[]');
        if (Array.isArray(parsedTags)) {
          tags = parsedTags.filter((tag: any) => typeof tag === 'string' && tag.trim() !== '');
        }
      } catch {}

      const mistakeDate = m.mistake_date || new Date(m.created_at).toISOString().slice(0, 10);

      let effFamId = m.familiarity_id || null;
      let effFamName = m.familiarity_name || null;
      let effFamColor = m.familiarity_color || null;
      let effFamIsActive = m.familiarity_is_active ?? null;

      // Smart fallback to discover familiarity if not directly joined
      if (!effFamId && parsedData) {
        const sections = [parsedData.answerData, parsedData.questionData, parsedData];
        for (const sec of sections) {
          if (sec && typeof sec === 'object') {
            for (const [, v] of Object.entries(sec)) {
              if (typeof v === 'string' && famNameToObj.has(v.trim())) {
                const matched = famNameToObj.get(v.trim())!;
                effFamId = matched.id;
                effFamName = matched.name;
                effFamColor = matched.color;
                effFamIsActive = matched.is_active;
                break;
              } else if (Array.isArray(v)) {
                for (const it of v) {
                  if (typeof it === 'string' && famNameToObj.has(it.trim())) {
                    const matched = famNameToObj.get(it.trim())!;
                    effFamId = matched.id;
                    effFamName = matched.name;
                    effFamColor = matched.color;
                    effFamIsActive = matched.is_active;
                    break;
                  }
                }
              }
              if (effFamId) break;
            }
            if (effFamId) break;
          }
        }
      }

      return {
        ...m,
        subject_id: m.effective_subject_id || null,
        chapter_id: m.chapter_id || null,
        unit_id: m.unit_id || null,
        familiarity_id: effFamId,
        familiarity_name: effFamName,
        familiarity_color: effFamColor,
        familiarity_is_active: effFamIsActive,
        error_reason_ids: errorReasonIds,
        error_reason_items: errorReasonItems,
        error_reason_names: errorReasonItems.map((item: any) => item.name),
        tags,
        mistake_date: mistakeDate,
        data: parsedData,
        template_fields: parsedTemplateFields
      };
    });

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

// POST /api/mistakes - Create a mistake record
export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const body = await request.json() as any;
    const title = body.title;
    const subjectId = body.subjectId !== undefined ? body.subjectId : body.subject_id;
    const chapterId = body.chapterId !== undefined ? body.chapterId : body.chapter_id;
    const unitId = body.unitId !== undefined ? body.unitId : body.unit_id;
    const familiarityId = body.familiarityId !== undefined ? body.familiarityId : body.familiarity_id;
    const errorReasonIds = body.errorReasonIds !== undefined ? body.errorReasonIds : body.error_reason_ids;
    const tags = body.tags;
    const mistakeDate = body.mistakeDate !== undefined ? body.mistakeDate : body.mistake_date;
    const templateId = body.templateId !== undefined ? body.templateId : body.template_id;
    const mistakeData = body.data || body.content;

    if (!title || title.trim() === '' || !mistakeData) {
      return new Response(JSON.stringify({ error: 'title and data are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let resolvedSubjectId: string | null = subjectId || null;
    let resolvedChapterId: string | null = chapterId || null;
    let resolvedUnitId: string | null = unitId || null;

    // Resolve hierarchy & verify ownership if provided
    if (resolvedUnitId) {
      const unitRow = await env.DB.prepare(
        `SELECT id, chapter_id, subject_id FROM units WHERE id = ? AND user_id = ?`
      ).bind(resolvedUnitId, userId).first() as any;
      if (!unitRow) {
        return new Response(JSON.stringify({ error: 'Unit not found or access denied.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      resolvedChapterId = unitRow.chapter_id;
      resolvedSubjectId = unitRow.subject_id;
    } else if (resolvedChapterId) {
      const chapRow = await env.DB.prepare(
        `SELECT c.id, c.subject_id FROM chapters c JOIN subjects s ON c.subject_id = s.id WHERE c.id = ? AND s.user_id = ?`
      ).bind(resolvedChapterId, userId).first() as any;
      if (!chapRow) {
        return new Response(JSON.stringify({ error: 'Chapter not found or access denied.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      resolvedSubjectId = chapRow.subject_id;
    } else if (resolvedSubjectId) {
      const subjRow = await env.DB.prepare(
        `SELECT id FROM subjects WHERE id = ? AND user_id = ?`
      ).bind(resolvedSubjectId, userId).first() as any;
      if (!subjRow) {
        return new Response(JSON.stringify({ error: 'Subject not found or access denied.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Verify or resolve template ownership
    let resolvedTemplateId = templateId;
    if (resolvedTemplateId) {
      const template = await env.DB.prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?')
        .bind(resolvedTemplateId, userId)
        .first();
      if (!template) {
        return new Response(JSON.stringify({ error: 'Template not found or access denied.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      const firstTpl = await env.DB.prepare('SELECT id FROM templates WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
        .bind(userId)
        .first() as any;
      resolvedTemplateId = firstTpl?.id || 'default';
    }

    // Resolve familiarityId: if not explicitly sent, check if mistakeData has legacy or template mastery values
    const parsedDataObj = typeof mistakeData === 'string' ? JSON.parse(mistakeData) : mistakeData;
    const resolvedFamiliarityId: string | null = await resolveFamiliarityIdFromData(env.DB, userId, familiarityId, parsedDataObj);

    if (resolvedFamiliarityId && parsedDataObj?.answerData) {
      const famRow = await env.DB.prepare(
        `SELECT name FROM categories WHERE id = ? AND user_id = ?`
      ).bind(resolvedFamiliarityId, userId).first() as any;
      if (famRow) {
        parsedDataObj.answerData.a_mastery = [famRow.name];
      }
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const dataStr = JSON.stringify(parsedDataObj);
    const errorReasonIdsStr = JSON.stringify(Array.isArray(errorReasonIds) ? errorReasonIds : []);
    const tagsStr = JSON.stringify(Array.isArray(tags) ? tags : []);
    const dateVal = mistakeDate || new Date(now).toISOString().slice(0, 10);

    await env.DB.prepare(
      `INSERT INTO mistakes (
        id, user_id, subject_id, chapter_id, unit_id, familiarity_id,
        error_reason_ids, tags, mistake_date, template_id, title, data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      resolvedSubjectId,
      resolvedChapterId,
      resolvedUnitId,
      resolvedFamiliarityId,
      errorReasonIdsStr,
      tagsStr,
      dateVal,
      resolvedTemplateId,
      title.trim(),
      dataStr,
      now,
      now
    )
    .run();

    return new Response(JSON.stringify({
      success: true,
      mistake: {
        id,
        user_id: userId,
        subject_id: resolvedSubjectId,
        chapter_id: resolvedChapterId,
        unit_id: resolvedUnitId,
        familiarity_id: resolvedFamiliarityId,
        error_reason_ids: Array.isArray(errorReasonIds) ? errorReasonIds : [],
        tags: Array.isArray(tags) ? tags : [],
        mistake_date: dateVal,
        template_id: resolvedTemplateId,
        title: title.trim(),
        data: parsedDataObj,
        created_at: now,
        updated_at: now
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

// PUT /api/mistakes - Update a mistake record
export const onRequestPut: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const body = await request.json() as any;
    const id = body.id;
    const title = body.title;
    const subjectId = body.subjectId !== undefined ? body.subjectId : body.subject_id;
    const chapterId = body.chapterId !== undefined ? body.chapterId : body.chapter_id;
    const unitId = body.unitId !== undefined ? body.unitId : body.unit_id;
    const familiarityId = body.familiarityId !== undefined ? body.familiarityId : body.familiarity_id;
    const errorReasonIds = body.errorReasonIds !== undefined ? body.errorReasonIds : body.error_reason_ids;
    const tags = body.tags;
    const mistakeDate = body.mistakeDate !== undefined ? body.mistakeDate : body.mistake_date;
    const mistakeData = body.data || body.content;

    if (!id || !title || title.trim() === '' || !mistakeData) {
      return new Response(JSON.stringify({ error: 'id, title, and data are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existing = await env.DB.prepare(
      `SELECT m.* FROM mistakes m
       LEFT JOIN chapters c ON m.chapter_id = c.id
       LEFT JOIN subjects s ON COALESCE(m.subject_id, c.subject_id) = s.id
       WHERE m.id = ? AND (m.user_id = ? OR s.user_id = ?)`
    ).bind(id, userId, userId).first() as any;

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Mistake record not found or access denied.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let nextSubjectId = subjectId !== undefined ? (subjectId || null) : existing.subject_id;
    let nextChapterId = chapterId !== undefined ? (chapterId || null) : existing.chapter_id;
    let nextUnitId = unitId !== undefined ? (unitId || null) : existing.unit_id;

    if (nextUnitId) {
      const unitRow = await env.DB.prepare(`SELECT chapter_id, subject_id FROM units WHERE id = ? AND user_id = ?`).bind(nextUnitId, userId).first() as any;
      if (unitRow) {
        nextChapterId = unitRow.chapter_id;
        nextSubjectId = unitRow.subject_id;
      }
    } else if (nextChapterId) {
      const chapRow = await env.DB.prepare(`SELECT subject_id FROM chapters WHERE id = ?`).bind(nextChapterId).first() as any;
      if (chapRow) {
        nextSubjectId = chapRow.subject_id;
      }
    }

    const parsedDataObj = typeof mistakeData === 'string' ? JSON.parse(mistakeData) : mistakeData;
    let nextFamiliarityId = familiarityId !== undefined ? (familiarityId || null) : existing.familiarity_id;
    if (!nextFamiliarityId && parsedDataObj) {
      nextFamiliarityId = await resolveFamiliarityIdFromData(env.DB, userId, null, parsedDataObj) || existing.familiarity_id;
    }

    const nextErrorReasonIds = errorReasonIds !== undefined ? JSON.stringify(Array.isArray(errorReasonIds) ? errorReasonIds : []) : (existing.error_reason_ids || '[]');
    const nextTags = tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : (existing.tags || '[]');
    const nextMistakeDate = mistakeDate !== undefined ? mistakeDate : (existing.mistake_date || new Date(existing.created_at).toISOString().slice(0, 10));

    if (nextFamiliarityId && parsedDataObj?.answerData) {
      const famRow = await env.DB.prepare(`SELECT name FROM categories WHERE id = ? AND user_id = ?`).bind(nextFamiliarityId, userId).first() as any;
      if (famRow) {
        parsedDataObj.answerData.a_mastery = [famRow.name];
      }
    }

    const dataStr = JSON.stringify(parsedDataObj);
    const now = Date.now();

    await env.DB.prepare(
      `UPDATE mistakes
       SET user_id = ?,
           subject_id = ?,
           chapter_id = ?,
           unit_id = ?,
           familiarity_id = ?,
           error_reason_ids = ?,
           tags = ?,
           mistake_date = ?,
           title = ?,
           data = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(
      userId,
      nextSubjectId,
      nextChapterId,
      nextUnitId,
      nextFamiliarityId,
      nextErrorReasonIds,
      nextTags,
      nextMistakeDate,
      title.trim(),
      dataStr,
      now,
      id
    )
    .run();

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

// DELETE /api/mistakes?id=xxx - Delete a mistake record
export const onRequestDelete: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Mistake id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await env.DB.prepare(
      `DELETE FROM mistakes 
       WHERE id = ? 
       AND (
         user_id = ? 
         OR EXISTS (
           SELECT 1 FROM chapters c 
           JOIN subjects s ON c.subject_id = s.id 
           WHERE c.id = mistakes.chapter_id 
           AND s.user_id = ?
         )
       )`
    )
    .bind(id, userId, userId)
    .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Mistake record not found or access denied.' }), {
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
