import { verifyPassword, signJWT } from './_utils';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { username, password } = await request.json() as any;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trimmedUsername = username.trim();

    // Query user
    const user = await env.DB.prepare('SELECT id, username, password_hash, is_admin FROM users WHERE username = ?')
      .bind(trimmedUsername)
      .first() as any;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid username or password.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ error: 'Invalid username or password.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sign token
    const jwtSecret = env.JWT_SECRET || 'local-dev-jwt-secret-key-12345';
    const payload = { id: user.id, username: user.username, is_admin: typeof user.is_admin === 'number' ? user.is_admin : 0 };
    const token = await signJWT(payload, jwtSecret);

    // Set cookie (HTTP-only)
    // Note: We omit "Secure" so it is fully testable on plain HTTP localhost.
    const cookie = `authToken=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`;

    return new Response(JSON.stringify({
      success: true,
      user: { id: user.id, username: user.username, is_admin: typeof user.is_admin === 'number' ? user.is_admin : 0 }
    }), {
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
