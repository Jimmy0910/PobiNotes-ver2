import { deleteUserAndData } from '../_deleteUserHelper';

interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string; is_admin: number };
}

// DELETE /api/admin/users/:id - Delete a user (admin only)
export const onRequestDelete: PagesFunction<Env, 'id', UserContext> = async (context) => {
  try {
    const { env, data, params } = context;
    if (!data.user || data.user.is_admin !== 1) {
      return new Response(JSON.stringify({ error: 'Forbidden. Admin access required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userIdToDelete = params.id as string;
    if (!userIdToDelete) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Call deletion helper
    await deleteUserAndData(userIdToDelete, env.DB);

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
