import { hashPassword, signJWT } from './_utils';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { username, password, is_admin, registerAsAdmin } = await request.json() as any;

    if (!username || !password || username.trim() === '' || password.length < 6) {
      return new Response(JSON.stringify({ error: 'Username must not be empty, and password must be at least 6 characters.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trimmedUsername = username.trim();

    // Check if user already exists
    const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
      .bind(trimmedUsername)
      .first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Username already exists.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Admin registration check
    const wantsAdmin = !!(is_admin === true || registerAsAdmin === true);
    if (wantsAdmin) {
      const adminExists = await env.DB.prepare('SELECT id FROM users WHERE is_admin = 1').first();
      if (adminExists) {
        return new Response(JSON.stringify({ error: 'Admin account already exists. Registration locked.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Create user
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const now = Date.now();
    const isAdminVal = wantsAdmin ? 1 : 0;

    await env.DB.prepare('INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, trimmedUsername, passwordHash, isAdminVal, now)
      .run();

    // Sign token
    const jwtSecret = env.JWT_SECRET || 'local-dev-jwt-secret-key-12345';
    const payload = { id: userId, username: trimmedUsername, is_admin: isAdminVal };
    const token = await signJWT(payload, jwtSecret);

    // Set cookie (HTTP-only)
    const cookie = `authToken=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`;

    return new Response(JSON.stringify({
      success: true,
      message: 'User registered successfully.',
      user: { id: userId, username: trimmedUsername, is_admin: isAdminVal }
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
