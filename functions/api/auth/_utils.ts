const ITERATIONS = 10000;
const KEY_LEN = 32;

// --- Password Hashing with PBKDF2 ---

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    KEY_LEN * 8
  );
  
  const hashHex = Array.from(new Uint8Array(derivedKey)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2$${ITERATIONS}$${saltHex}$${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const storedHashHex = parts[3];
    
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const derivedKey = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      baseKey,
      KEY_LEN * 8
    );
    
    const hashHex = Array.from(new Uint8Array(derivedKey)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === storedHashHex;
  } catch (e) {
    return false;
  }
}

// --- JWT Sign / Verify Helper ---

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function signJWT(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const headerStr = arrayBufferToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadStr = arrayBufferToBase64Url(encoder.encode(JSON.stringify(payload)));
  
  const message = `${headerStr}.${payloadStr}`;
  const messageBytes = encoder.encode(message);
  
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    messageBytes
  );
  
  const signatureStr = arrayBufferToBase64Url(signatureBuffer);
  return `${message}.${signatureStr}`;
}

export async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerStr, payloadStr, signatureStr] = parts;
    const encoder = new TextEncoder();
    const message = `${headerStr}.${payloadStr}`;
    const messageBytes = encoder.encode(message);
    
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBuffer = base64UrlToArrayBuffer(signatureStr);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      signatureBuffer,
      messageBytes
    );
    
    if (!isValid) return null;
    
    const decoder = new TextDecoder();
    const payloadJson = decoder.decode(base64UrlToArrayBuffer(payloadStr));
    return JSON.parse(payloadJson);
  } catch (e) {
    return null;
  }
}
