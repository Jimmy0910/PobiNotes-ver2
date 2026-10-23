import { deleteUserAndData } from '../admin/_deleteUserHelper';

interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string; is_admin: number };
}

// DELETE /api/users/delete - User self-deletion
export const onRequestDelete: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { env, data } = context;
    if (!data.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please login.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = data.user.id;

    // Perform cascading deletion
    await deleteUserAndData(userId, env.DB);

    // Clear session cookie
    const cookie = 'authToken=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax';

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie
      }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
