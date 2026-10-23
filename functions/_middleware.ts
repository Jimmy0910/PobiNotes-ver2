import { verifyJWT } from './api/auth/_utils';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET?: string;
}

export const onRequest: PagesFunction<Env, any, { user?: { id: string; username: string; is_admin: number } }> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  
  const isApiRequest = url.pathname.startsWith('/api/');
  const isAuthRequest = url.pathname.startsWith('/api/auth/login') || url.pathname.startsWith('/api/auth/register');
  
  const jwtSecret = env.JWT_SECRET || 'local-dev-jwt-secret-key-12345';
  
  let user = null;
  
  // Parse Cookie header
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const parts = c.trim().split('=');
      return [parts[0], parts.slice(1).join('=')];
    })
  );
  
  const token = cookies['authToken'];
  
  if (token) {
    const payload = await verifyJWT(token, jwtSecret);
    if (payload && payload.id && payload.username) {
      user = {
        id: payload.id,
        username: payload.username,
        is_admin: typeof payload.is_admin === 'number' ? payload.is_admin : 0
      };
      context.data.user = user;
    }
  }
  
  // Handle CORS Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }

  // Block unauthorized API requests (excluding login/register)
  if (isApiRequest && !isAuthRequest && !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Please login.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const response = await next();
  
  // Add CORS headers to all API responses
  if (isApiRequest) {
    const newHeaders = new Headers(response.headers);
    const origin = request.headers.get('Origin') || '*';
    newHeaders.set('Access-Control-Allow-Origin', origin);
    newHeaders.set('Access-Control-Allow-Credentials', 'true');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  
  return response;
};
