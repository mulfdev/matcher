type BaseFetcherOptions = {
  url: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

type GetFetcherOptions = BaseFetcherOptions & {
  method?: 'GET';
  body?: never;
};

type PostFetcherOptions<TBody = unknown> = BaseFetcherOptions & {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: TBody;
};

type FetcherOptions<TBody = unknown> = GetFetcherOptions | PostFetcherOptions<TBody>;

export const apiUrl = import.meta.env.VITE_API_URL;

export async function fetcher<TResponse, TBody = unknown>(
  options: FetcherOptions<TBody>
): Promise<TResponse> {
  const { url, method = 'GET', headers = {}, signal, body } = options;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
