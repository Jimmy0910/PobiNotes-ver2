interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env, 'key'> = async (context) => {
  try {
    const { env, params } = context;
    const key = params.key as string;

    if (!key) {
      return new Response('Missing image key', { status: 400 });
    }

    // Get the object from D1 database
    const image = await env.DB.prepare(
      'SELECT data, mime_type FROM images WHERE key = ?'
    ).bind(key).first<{ data: any; mime_type: string }>();

    if (!image) {
      return new Response('Image not found', { status: 404 });
    }

    // D1 driver may return binary BLOBs as an array of numbers.
    // We convert it robustly into a Uint8Array.
    let binaryData: Uint8Array;
    if (image.data instanceof Uint8Array) {
      binaryData = image.data;
    } else if (image.data instanceof ArrayBuffer) {
      binaryData = new Uint8Array(image.data);
    } else if (Array.isArray(image.data)) {
      binaryData = new Uint8Array(image.data);
    } else if (typeof image.data === 'object' && image.data !== null) {
      // Handles array-like objects or serialized buffers: { "0": 137, "1": 80, ... }
      const arr = Object.values(image.data) as number[];
      binaryData = new Uint8Array(arr);
    } else {
      binaryData = new Uint8Array(image.data);
    }

    const headers = new Headers();
    headers.set('Content-Type', image.mime_type);
    headers.set('Cache-Control', 'public, max-age=604800'); // Cache on client for 1 week
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(binaryData, {
      headers
    });
  } catch (e: any) {
    return new Response(e.message || 'Internal Server Error', { status: 500 });
  }
};
