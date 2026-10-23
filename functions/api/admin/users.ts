interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string; is_admin: number };
}

// GET /api/admin/users - Retrieve all users (admin only)
export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { env, data } = context;
    if (!data.user || data.user.is_admin !== 1) {
      return new Response(JSON.stringify({ error: 'Forbidden. Admin access required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const users = await env.DB.prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC')
      .all();

    return new Response(JSON.stringify(users.results), {
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
