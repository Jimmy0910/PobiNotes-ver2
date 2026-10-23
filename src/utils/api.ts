const BASE_URL = ''; // Relative paths since frontend and backend are deployed together on Pages

export async function apiRequest<T = any>(
  endpoint: string,
  options: Omit<RequestInit, 'body'> & { body?: any } = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  // Default to credentials 'include' so HTTP-only auth cookies are sent and stored properly
  const config = {
    ...options,
    credentials: options.credentials || 'include',
  } as RequestInit;

  // Set Content-Type: application/json if body is not a binary blob or form data
  if (config.body && !(config.body instanceof Blob) && !(config.body instanceof FormData)) {
    config.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    if (typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorMsg = `Request failed with status ${response.status}`;
    try {
      const data = await response.json() as any;
      if (data.error) errorMsg = data.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const text = await response.text();
  try {
    return text ? JSON.parse(text) : ({ success: true } as T);
  } catch {
    return text as any as T;
  }
}
