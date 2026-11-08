/** Model transport: one loopback endpoint, JSON output, no cloud redirects. */
export const localOnlyFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (
    url !== 'http://127.0.0.1:11435/api/chat' ||
    typeof init?.body !== 'string'
  ) {
    throw new Error(
      'Local categorizer refused a nonlocal or unexpected model request',
    );
  }
  const body = JSON.parse(init.body);
  if (body.model !== 'qwen3:4b') {
    throw new Error('Local categorizer requires the downloaded qwen3:4b model');
  }
  return fetch(url, {
    ...init,
    redirect: 'error',
    body: JSON.stringify({
      ...body,
      think: false,
      format: 'json',
      options: { ...body.options, num_predict: 128, num_ctx: 4096 },
    }),
  });
};
