import { fetcher } from '~/core';

export async function authLoader() {
  try {
    await fetcher({ url: '/auth/me' });
    return null;
  } catch {
    throw new Response(null, { status: 302, headers: { Location: '/login' } });
  }
}
