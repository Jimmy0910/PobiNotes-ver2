interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string; is_admin: number };
}

// GET /api/feedback - Retrieve all feedback (admin only)
export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { env, data } = context;
    if (!data.user || data.user.is_admin !== 1) {
      return new Response(JSON.stringify({ error: 'Forbidden. Admin access required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const feedbackList = await env.DB.prepare('SELECT id, rating, comment, created_at, user_id FROM feedback ORDER BY created_at DESC')
      .all();

    return new Response(JSON.stringify(feedbackList.results), {
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

// POST /api/feedback - Create feedback
export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    if (!data.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please login.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = data.user.id;
    const { rating, comment } = await request.json() as any;

    if (typeof rating !== 'number' || !comment || comment.trim() === '') {
      return new Response(JSON.stringify({ error: 'Rating and comment are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await env.DB.prepare('INSERT INTO feedback (id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, userId, rating, comment.trim(), now)
      .run();

    return new Response(JSON.stringify({ success: true, feedback: { id, rating, comment: comment.trim(), created_at: now } }), {
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
