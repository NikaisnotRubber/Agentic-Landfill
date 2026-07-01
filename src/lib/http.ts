type JsonRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

type MaybeOkPayload = {
  ok?: boolean;
};

export async function requestJson<T>(
  url: string,
  options: JsonRequestOptions = {},
  requestLabel = "Request",
): Promise<T> {
  const { body, ...rest } = options;
  const init: RequestInit = { ...rest };

  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json", ...rest.headers };
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const payload = (await response.json()) as T & MaybeOkPayload;

  if (!response.ok && payload.ok === true) {
    return { ok: false, error: `${requestLabel} failed with ${response.status}` } as T;
  }

  return payload;
}