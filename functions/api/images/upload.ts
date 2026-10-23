interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string };
}

// POST /api/images/upload - Upload a raw image file to D1
export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env } = context;
    const contentType = request.headers.get('Content-Type') || 'image/jpeg';
    
    // Check content type is indeed an image
    if (!contentType.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'Only image files are allowed.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.arrayBuffer();
    if (body.byteLength === 0) {
      return new Response(JSON.stringify({ error: 'Empty file body.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate unique key
    const extension = contentType.split('/')[1] || 'jpg';
    const key = `${crypto.randomUUID()}.${extension}`;

    // Store image blob inside D1 database
    await env.DB.prepare(
      'INSERT INTO images (key, data, mime_type, created_at) VALUES (?, ?, ?, ?)'
    ).bind(key, body, contentType, Date.now()).run();

    return new Response(JSON.stringify({ success: true, key }), {
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
