import { ensureSchemaAndUserDefaults } from './_dbInit';

interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string };
}

export interface CategoryItem {
  id: string;
  dimension: 'subject' | 'chapter' | 'unit' | 'familiarity' | 'error_reason';
  parent_id: string | null;
  subject_id?: string | null;
  name: string;
  color: string;
  sort_order: number;
  is_active: number;
  created_at: number;
  updated_at: number;
  mistake_count: number;
}

export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { env, data } = context;
    const userId = data.user!.id;

    await ensureSchemaAndUserDefaults(env.DB, userId);

    const [subjectsRes, chaptersRes, unitsRes, catsRes, mistakesRes, settingsRes] = await Promise.all([
      env.DB.prepare(
        `SELECT * FROM subjects WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC`
      ).bind(userId).all(),
      env.DB.prepare(
        `SELECT c.* FROM chapters c
         JOIN subjects s ON c.subject_id = s.id
         WHERE s.user_id = ?
         ORDER BY c.sort_order ASC, c.created_at ASC`
      ).bind(userId).all(),
      env.DB.prepare(
        `SELECT * FROM units WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC`
      ).bind(userId).all(),
      env.DB.prepare(
        `SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC`
      ).bind(userId).all(),
      env.DB.prepare(
        `SELECT m.id, m.subject_id, m.chapter_id, m.unit_id, m.familiarity_id, m.error_reason_ids, c.subject_id as chap_subject_id
         FROM mistakes m
         LEFT JOIN chapters c ON m.chapter_id = c.id
         LEFT JOIN subjects s ON COALESCE(m.subject_id, c.subject_id) = s.id
         WHERE m.user_id = ? OR s.user_id = ?`
      ).bind(userId, userId).all(),
      env.DB.prepare(
        `SELECT error_reason_mode FROM user_settings WHERE user_id = ?`
      ).bind(userId).first()
    ]);

    // Count mistakes per category ID
    const counts: Record<string, number> = {};
    const inc = (id: string | null | undefined) => {
      if (!id) return;
      counts[id] = (counts[id] || 0) + 1;
    };

    for (const m of (mistakesRes.results || []) as any[]) {
      const effSubjectId = m.subject_id || m.chap_subject_id || null;
      inc(effSubjectId);
      inc(m.chapter_id);
      inc(m.unit_id);
      inc(m.familiarity_id);
      if (m.error_reason_ids) {
        try {
          const arr = JSON.parse(m.error_reason_ids);
          if (Array.isArray(arr)) {
            for (const rId of arr) inc(rId);
          }
        } catch {}
      }
    }

    const subjects: CategoryItem[] = (subjectsRes.results || []).map((s: any) => ({
      id: s.id,
      dimension: 'subject',
      parent_id: null,
      subject_id: s.id,
      name: s.name,
      color: s.color || 'default',
      sort_order: s.sort_order ?? 0,
      is_active: s.is_active ?? 1,
      created_at: s.created_at,
      updated_at: s.updated_at || s.created_at,
      mistake_count: counts[s.id] || 0
    }));

    const chapters: CategoryItem[] = (chaptersRes.results || []).map((c: any) => ({
      id: c.id,
      dimension: 'chapter',
      parent_id: c.subject_id,
      subject_id: c.subject_id,
      name: c.name,
      color: c.color || 'default',
      sort_order: c.sort_order ?? 0,
      is_active: c.is_active ?? 1,
      created_at: c.created_at,
      updated_at: c.updated_at || c.created_at,
      mistake_count: counts[c.id] || 0
    }));

    const units: CategoryItem[] = (unitsRes.results || []).map((u: any) => ({
      id: u.id,
      dimension: 'unit',
      parent_id: u.chapter_id,
      subject_id: u.subject_id,
      name: u.name,
      color: u.color || 'default',
      sort_order: u.sort_order ?? 0,
      is_active: u.is_active ?? 1,
      created_at: u.created_at,
      updated_at: u.updated_at || u.created_at,
      mistake_count: counts[u.id] || 0
    }));

    const subjectMap = new Map<string, CategoryItem>();
    for (const s of subjects) subjectMap.set(s.id, s);

    const chapterMap = new Map<string, CategoryItem>();
    for (const c of chapters) chapterMap.set(c.id, c);

    const familiarities: CategoryItem[] = [];
    const errorReasons: CategoryItem[] = [];

    for (const cat of (catsRes.results || []) as any[]) {
      let resolvedParentId: string | null = cat.parent_id || null;
      let resolvedSubjectId: string | null = null;

      if (cat.dimension === 'error_reason' && resolvedParentId) {
        const chap = chapterMap.get(resolvedParentId);
        if (chap) {
          resolvedSubjectId = chap.subject_id || chap.parent_id || null;
        } else if (subjectMap.has(resolvedParentId)) {
          resolvedSubjectId = resolvedParentId;
        } else {
          // Parent was deleted; fallback to global error reason
          resolvedParentId = null;
          resolvedSubjectId = null;
        }
      }

      const item: CategoryItem = {
        id: cat.id,
        dimension: cat.dimension,
        parent_id: resolvedParentId,
        subject_id: resolvedSubjectId,
        name: cat.name,
        color: cat.color || 'default',
        sort_order: cat.sort_order ?? 0,
        is_active: cat.is_active ?? 1,
        created_at: cat.created_at,
        updated_at: cat.updated_at || cat.created_at,
        mistake_count: counts[cat.id] || 0
      };
      if (cat.dimension === 'familiarity') {
        familiarities.push(item);
      } else if (cat.dimension === 'error_reason') {
        errorReasons.push(item);
      }
    }

    const items = [...subjects, ...chapters, ...units, ...familiarities, ...errorReasons];

    return new Response(JSON.stringify({
      items,
      subjects,
      chapters,
      units,
      familiarities,
      errorReasons,
      errorReasonMode: (settingsRes as any)?.error_reason_mode || 'multi'
    }), {
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

export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const body = await request.json() as any;
    const rawParentId = body.parentId !== undefined ? body.parentId : body.parent_id;
    const { dimension, name, color = 'default', sortOrder } = body;
    const parentId = rawParentId;

    if (!dimension || !name || !name.trim()) {
      return new Response(JSON.stringify({ error: '分類維度與名稱為必填' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trimmedName = name.trim();
    const id = crypto.randomUUID();
    const now = Date.now();
    const orderVal = typeof sortOrder === 'number' ? sortOrder : 0;

    if (dimension === 'subject') {
      // Get min sort_order so newly created subjects appear at the top if sortOrder not specified
      let finalOrder = orderVal;
      if (typeof sortOrder !== 'number') {
        const minRow = await env.DB.prepare(`SELECT MIN(sort_order) as min_order FROM subjects WHERE user_id = ?`).bind(userId).first() as any;
        finalOrder = (minRow?.min_order ?? 10) - 1;
      }
      await env.DB.prepare(
        `INSERT INTO subjects (id, user_id, name, color, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      ).bind(id, userId, trimmedName, color, finalOrder, now, now).run();

      return new Response(JSON.stringify({
        success: true,
        item: { id, dimension: 'subject', parent_id: null, subject_id: id, name: trimmedName, color, sort_order: finalOrder, is_active: 1, created_at: now, updated_at: now, mistake_count: 0 }
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    if (dimension === 'chapter') {
      if (!parentId) {
        return new Response(JSON.stringify({ error: '建立章節必須選擇所屬科目' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const subject = await env.DB.prepare(`SELECT id FROM subjects WHERE id = ? AND user_id = ?`).bind(parentId, userId).first();
      if (!subject) {
        return new Response(JSON.stringify({ error: '找不到指定的所屬科目' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      const maxRow = await env.DB.prepare(`SELECT MAX(sort_order) as max_order FROM chapters WHERE subject_id = ?`).bind(parentId).first() as any;
      const finalOrder = typeof sortOrder === 'number' ? sortOrder : ((maxRow?.max_order ?? 0) + 10);

      await env.DB.prepare(
        `INSERT INTO chapters (id, subject_id, name, color, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      ).bind(id, parentId, trimmedName, color, finalOrder, now, now).run();

      return new Response(JSON.stringify({
        success: true,
        item: { id, dimension: 'chapter', parent_id: parentId, subject_id: parentId, name: trimmedName, color, sort_order: finalOrder, is_active: 1, created_at: now, updated_at: now, mistake_count: 0 }
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    if (dimension === 'unit') {
      if (!parentId) {
        return new Response(JSON.stringify({ error: '建立單元必須選擇所屬章節' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const chapter = await env.DB.prepare(
        `SELECT c.id, c.subject_id FROM chapters c JOIN subjects s ON c.subject_id = s.id WHERE c.id = ? AND s.user_id = ?`
      ).bind(parentId, userId).first() as any;
      if (!chapter) {
        return new Response(JSON.stringify({ error: '找不到指定的所屬章節' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      const maxRow = await env.DB.prepare(`SELECT MAX(sort_order) as max_order FROM units WHERE chapter_id = ?`).bind(parentId).first() as any;
      const finalOrder = typeof sortOrder === 'number' ? sortOrder : ((maxRow?.max_order ?? 0) + 10);

      await env.DB.prepare(
        `INSERT INTO units (id, user_id, subject_id, chapter_id, name, color, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).bind(id, userId, chapter.subject_id, parentId, trimmedName, color, finalOrder, now, now).run();

      return new Response(JSON.stringify({
        success: true,
        item: { id, dimension: 'unit', parent_id: parentId, subject_id: chapter.subject_id, name: trimmedName, color, sort_order: finalOrder, is_active: 1, created_at: now, updated_at: now, mistake_count: 0 }
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    if (dimension === 'familiarity' || dimension === 'error_reason') {
      const maxRow = await env.DB.prepare(`SELECT MAX(sort_order) as max_order FROM categories WHERE user_id = ? AND dimension = ?`).bind(userId, dimension).first() as any;
      const finalOrder = typeof sortOrder === 'number' ? sortOrder : ((maxRow?.max_order ?? 0) + 10);

      let resolvedSubjectId: string | null = null;
      const cleanParentId = parentId ? String(parentId).trim() : null;
      if (dimension === 'error_reason' && cleanParentId) {
        const chap = await env.DB.prepare(`SELECT subject_id FROM chapters WHERE id = ?`).bind(cleanParentId).first() as any;
        if (chap) {
          resolvedSubjectId = chap.subject_id;
        } else {
          resolvedSubjectId = cleanParentId;
        }
      }

      await env.DB.prepare(
        `INSERT INTO categories (id, user_id, dimension, parent_id, name, color, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).bind(id, userId, dimension, cleanParentId, trimmedName, color, finalOrder, now, now).run();

      return new Response(JSON.stringify({
        success: true,
        item: { id, dimension, parent_id: cleanParentId, subject_id: resolvedSubjectId, name: trimmedName, color, sort_order: finalOrder, is_active: 1, created_at: now, updated_at: now, mistake_count: 0 }
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: '不支援的分類維度' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPut: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    const body = await request.json() as any;
    const now = Date.now();

    // Action 1: Toggle error_reason_mode ('multi' | 'single')
    if (body.action === 'set_error_reason_mode') {
      const mode = body.mode === 'single' ? 'single' : 'multi';
      await env.DB.prepare(
        `INSERT INTO user_settings (user_id, categories_seeded, error_reason_mode, updated_at)
         VALUES (?, 1, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET error_reason_mode = excluded.error_reason_mode, updated_at = excluded.updated_at`
      ).bind(userId, mode, now).run();
      return new Response(JSON.stringify({ success: true, errorReasonMode: mode }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action 2: Bulk reorder within a dimension
    if (body.action === 'reorder') {
      const { dimension, orderedIds } = body;
      if (!dimension || !Array.isArray(orderedIds)) {
        return new Response(JSON.stringify({ error: 'dimension and orderedIds are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        const itemId = orderedIds[i];
        const nextOrder = (i + 1) * 10;
        if (dimension === 'subject') {
          await env.DB.prepare(`UPDATE subjects SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
            .bind(nextOrder, now, itemId, userId).run();
        } else if (dimension === 'chapter') {
          await env.DB.prepare(
            `UPDATE chapters SET sort_order = ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM subjects s WHERE s.id = chapters.subject_id AND s.user_id = ?)`
          ).bind(nextOrder, now, itemId, userId).run();
        } else if (dimension === 'unit') {
          await env.DB.prepare(`UPDATE units SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
            .bind(nextOrder, now, itemId, userId).run();
        } else {
          await env.DB.prepare(`UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
            .bind(nextOrder, now, itemId, userId).run();
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Action 3: Standard update (name, color, is_active, parent_id, sort_order)
    const { id, dimension, name, color, is_active, parent_id, sort_order } = body;
    if (!id || !dimension) {
      return new Response(JSON.stringify({ error: 'id and dimension are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (dimension === 'subject') {
      const existing = await env.DB.prepare(`SELECT * FROM subjects WHERE id = ? AND user_id = ?`).bind(id, userId).first() as any;
      if (!existing) return new Response(JSON.stringify({ error: 'Subject not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      await env.DB.prepare(
        `UPDATE subjects SET name = ?, color = ?, is_active = ?, sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?`
      ).bind(
        name !== undefined ? name.trim() : existing.name,
        color !== undefined ? color : (existing.color || 'default'),
        is_active !== undefined ? (is_active ? 1 : 0) : (existing.is_active ?? 1),
        sort_order !== undefined ? sort_order : (existing.sort_order ?? 0),
        now,
        id,
        userId
      ).run();
    } else if (dimension === 'chapter') {
      const existing = await env.DB.prepare(
        `SELECT c.* FROM chapters c JOIN subjects s ON c.subject_id = s.id WHERE c.id = ? AND s.user_id = ?`
      ).bind(id, userId).first() as any;
      if (!existing) return new Response(JSON.stringify({ error: 'Chapter not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      const nextSubjectId = parent_id || existing.subject_id;
      await env.DB.prepare(
        `UPDATE chapters SET name = ?, subject_id = ?, color = ?, is_active = ?, sort_order = ?, updated_at = ? WHERE id = ?`
      ).bind(
        name !== undefined ? name.trim() : existing.name,
        nextSubjectId,
        color !== undefined ? color : (existing.color || 'default'),
        is_active !== undefined ? (is_active ? 1 : 0) : (existing.is_active ?? 1),
        sort_order !== undefined ? sort_order : (existing.sort_order ?? 0),
        now,
        id
      ).run();
      if (parent_id && parent_id !== existing.subject_id) {
        await env.DB.prepare(`UPDATE units SET subject_id = ?, updated_at = ? WHERE chapter_id = ? AND user_id = ?`).bind(parent_id, now, id, userId).run();
        await env.DB.prepare(`UPDATE mistakes SET subject_id = ?, updated_at = ? WHERE chapter_id = ? AND user_id = ?`).bind(parent_id, now, id, userId).run();
      }
    } else if (dimension === 'unit') {
      const existing = await env.DB.prepare(`SELECT * FROM units WHERE id = ? AND user_id = ?`).bind(id, userId).first() as any;
      if (!existing) return new Response(JSON.stringify({ error: 'Unit not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      let nextChapterId = parent_id || existing.chapter_id;
      let nextSubjectId = existing.subject_id;
      if (parent_id && parent_id !== existing.chapter_id) {
        const ch = await env.DB.prepare(`SELECT subject_id FROM chapters WHERE id = ?`).bind(parent_id).first() as any;
        if (ch) nextSubjectId = ch.subject_id;
      }
      await env.DB.prepare(
        `UPDATE units SET name = ?, chapter_id = ?, subject_id = ?, color = ?, is_active = ?, sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?`
      ).bind(
        name !== undefined ? name.trim() : existing.name,
        nextChapterId,
        nextSubjectId,
        color !== undefined ? color : (existing.color || 'default'),
        is_active !== undefined ? (is_active ? 1 : 0) : (existing.is_active ?? 1),
        sort_order !== undefined ? sort_order : (existing.sort_order ?? 0),
        now,
        id,
        userId
      ).run();
    } else {
      const existing = await env.DB.prepare(`SELECT * FROM categories WHERE id = ? AND user_id = ?`).bind(id, userId).first() as any;
      if (!existing) return new Response(JSON.stringify({ error: 'Category not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      const nextParentId = parent_id !== undefined ? (parent_id || null) : (existing.parent_id || null);
      await env.DB.prepare(
        `UPDATE categories SET name = ?, color = ?, parent_id = ?, is_active = ?, sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?`
      ).bind(
        name !== undefined ? name.trim() : existing.name,
        color !== undefined ? color : (existing.color || 'default'),
        nextParentId,
        is_active !== undefined ? (is_active ? 1 : 0) : (existing.is_active ?? 1),
        sort_order !== undefined ? sort_order : (existing.sort_order ?? 0),
        now,
        id,
        userId
      ).run();
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestDelete: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    await ensureSchemaAndUserDefaults(env.DB, userId);

    let body: any = {};
    try {
      if (request.headers.get('content-type')?.includes('application/json')) {
        body = await request.json();
      }
    } catch (_) {}

    const url = new URL(request.url);
    const id = url.searchParams.get('id') || body.id;
    let dimension = url.searchParams.get('dimension') || body.dimension;
    const mode = url.searchParams.get('mode') || body.mode || 'reassign'; // 'reassign' | 'unassign' | 'disable' | 'purge'
    const targetId = url.searchParams.get('targetId') || body.targetId || null;

    if (!id) {
      return new Response(JSON.stringify({ error: 'id is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!dimension) {
      // Auto-detect dimension from database
      const isChap = await env.DB.prepare(`SELECT id FROM chapters WHERE id = ?`).bind(id).first();
      if (isChap) {
        dimension = 'chapter';
      } else {
        const isSubj = await env.DB.prepare(`SELECT id FROM subjects WHERE id = ? AND user_id = ?`).bind(id, userId).first();
        if (isSubj) {
          dimension = 'subject';
        } else {
          const isUnit = await env.DB.prepare(`SELECT id FROM units WHERE id = ? AND user_id = ?`).bind(id, userId).first();
          if (isUnit) {
            dimension = 'unit';
          } else {
            const cat = await env.DB.prepare(`SELECT dimension FROM categories WHERE id = ? AND user_id = ?`).bind(id, userId).first() as any;
            if (cat && cat.dimension) {
              dimension = cat.dimension;
            }
          }
        }
      }
    }

    if (!dimension) {
      return new Response(JSON.stringify({ error: 'Dimension could not be resolved for id: ' + id }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const now = Date.now();

    if (mode === 'disable') {
      if (dimension === 'subject') {
        await env.DB.prepare(`UPDATE subjects SET is_active = 0, updated_at = ? WHERE id = ? AND user_id = ?`).bind(now, id, userId).run();
      } else if (dimension === 'chapter') {
        await env.DB.prepare(
          `UPDATE chapters SET is_active = 0, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM subjects s WHERE s.id = chapters.subject_id AND s.user_id = ?)`
        ).bind(now, id, userId).run();
      } else if (dimension === 'unit') {
        await env.DB.prepare(`UPDATE units SET is_active = 0, updated_at = ? WHERE id = ? AND user_id = ?`).bind(now, id, userId).run();
      } else {
        await env.DB.prepare(`UPDATE categories SET is_active = 0, updated_at = ? WHERE id = ? AND user_id = ?`).bind(now, id, userId).run();
      }
      return new Response(JSON.stringify({ success: true, action: 'disabled' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (dimension === 'subject') {
      if (mode === 'purge') {
        await env.DB.prepare(
          `DELETE FROM mistakes WHERE (subject_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE subject_id = ?)) AND user_id = ?`
        ).bind(id, id, userId).run();
      } else {
        const newSubjId = (mode === 'reassign' && targetId && targetId !== 'uncategorized') ? targetId : null;
        await env.DB.prepare(
          `UPDATE mistakes SET subject_id = ?, chapter_id = NULL, unit_id = NULL, updated_at = ?
           WHERE (subject_id = ? OR chapter_id IN (SELECT id FROM chapters WHERE subject_id = ?)) AND user_id = ?`
        ).bind(newSubjId, now, id, id, userId).run();
      }
      await env.DB.prepare(`DELETE FROM units WHERE subject_id = ? AND user_id = ?`).bind(id, userId).run();
      await env.DB.prepare(`DELETE FROM chapters WHERE subject_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM subjects WHERE id = ? AND user_id = ?`).bind(id, userId).run();
    } else if (dimension === 'chapter') {
      const chapInfo = await env.DB.prepare(`SELECT subject_id FROM chapters WHERE id = ?`).bind(id).first() as any;
      const chapSubjectId = chapInfo?.subject_id || null;
      if (mode === 'purge') {
        await env.DB.prepare(`DELETE FROM mistakes WHERE chapter_id = ? AND (user_id = ? OR user_id IS NULL)`).bind(id, userId).run();
      } else {
        let newChapId: string | null = null;
        let newSubjId: string | null = chapSubjectId;
        if (mode === 'reassign' && targetId && targetId !== 'uncategorized') {
          newChapId = targetId;
          const targetChap = await env.DB.prepare(`SELECT subject_id FROM chapters WHERE id = ?`).bind(targetId).first() as any;
          if (targetChap) newSubjId = targetChap.subject_id;
        }
        if (newChapId && newSubjId) {
          await env.DB.prepare(
            `UPDATE mistakes SET subject_id = ?, chapter_id = ?, unit_id = NULL, updated_at = ? WHERE chapter_id = ? AND (user_id = ? OR user_id IS NULL)`
          ).bind(newSubjId, newChapId, now, id, userId).run();
        } else {
          await env.DB.prepare(
            `UPDATE mistakes SET subject_id = COALESCE(subject_id, ?), chapter_id = NULL, unit_id = NULL, updated_at = ? WHERE chapter_id = ? AND (user_id = ? OR user_id IS NULL)`
          ).bind(chapSubjectId, now, id, userId).run();
        }
      }
      // Reassign chapter-scoped error reasons up to subject scope so they aren't orphaned
      await env.DB.prepare(`UPDATE categories SET parent_id = ?, updated_at = ? WHERE parent_id = ? AND user_id = ?`).bind(chapSubjectId, now, id, userId).run();
      await env.DB.prepare(`DELETE FROM units WHERE chapter_id = ? AND user_id = ?`).bind(id, userId).run();
      await env.DB.prepare(
        `DELETE FROM chapters WHERE id = ? AND EXISTS (SELECT 1 FROM subjects s WHERE s.id = chapters.subject_id AND s.user_id = ?)`
      ).bind(id, userId).run();
    } else if (dimension === 'unit') {
      if (mode === 'purge') {
        await env.DB.prepare(`DELETE FROM mistakes WHERE unit_id = ? AND user_id = ?`).bind(id, userId).run();
      } else {
        const newUnitId = (mode === 'reassign' && targetId && targetId !== 'uncategorized') ? targetId : null;
        await env.DB.prepare(`UPDATE mistakes SET unit_id = ?, updated_at = ? WHERE unit_id = ? AND user_id = ?`)
          .bind(newUnitId, now, id, userId).run();
      }
      await env.DB.prepare(`DELETE FROM units WHERE id = ? AND user_id = ?`).bind(id, userId).run();
    } else if (dimension === 'familiarity') {
      if (mode === 'purge') {
        await env.DB.prepare(`DELETE FROM mistakes WHERE familiarity_id = ? AND user_id = ?`).bind(id, userId).run();
      } else {
        const newFamId = (mode === 'reassign' && targetId && targetId !== 'uncategorized') ? targetId : null;
        await env.DB.prepare(`UPDATE mistakes SET familiarity_id = ?, updated_at = ? WHERE familiarity_id = ? AND user_id = ?`)
          .bind(newFamId, now, id, userId).run();
      }
      await env.DB.prepare(`DELETE FROM categories WHERE id = ? AND user_id = ?`).bind(id, userId).run();
    } else if (dimension === 'error_reason') {
      const userMistakes = await env.DB.prepare(`SELECT id, error_reason_ids FROM mistakes WHERE user_id = ?`).bind(userId).all();
      for (const m of (userMistakes.results || []) as any[]) {
        try {
          const arr: string[] = JSON.parse(m.error_reason_ids || '[]');
          if (Array.isArray(arr) && arr.includes(id)) {
            if (mode === 'purge') {
              await env.DB.prepare(`DELETE FROM mistakes WHERE id = ? AND user_id = ?`).bind(m.id, userId).run();
            } else {
              let nextArr = arr.filter(x => x !== id);
              if (mode === 'reassign' && targetId && targetId !== 'uncategorized' && !nextArr.includes(targetId)) {
                nextArr.push(targetId);
              }
              await env.DB.prepare(`UPDATE mistakes SET error_reason_ids = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
                .bind(JSON.stringify(nextArr), now, m.id, userId).run();
            }
          }
        } catch {}
      }
      await env.DB.prepare(`DELETE FROM categories WHERE id = ? AND user_id = ?`).bind(id, userId).run();
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
