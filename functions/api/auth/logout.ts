export const onRequestPost: PagesFunction = async () => {
  // Clear the token cookie
  const cookie = 'authToken=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax';
  
  return new Response(JSON.stringify({ success: true, message: 'Logged out successfully.' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie
    }
  });
};
