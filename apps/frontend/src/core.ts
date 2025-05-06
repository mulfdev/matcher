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

  const isFormData = body instanceof FormData;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      ...headers,
    },
    credentials: 'include',
    signal,
  };

  if (body) {
    if (isFormData) {
      fetchOptions.body = body;
    } else {
      fetchOptions.headers = {
        'Content-Type': 'application/json',
        ...headers,
      };
      fetchOptions.body = JSON.stringify(body);
    }
  }

  const response = await fetch(`${apiUrl}${url}`, fetchOptions);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}
