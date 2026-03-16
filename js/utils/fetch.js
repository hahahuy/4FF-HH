/**
 * POST JSON to a Cloud Function endpoint and return the parsed response.
 * Throws a descriptive Error on network failure, 429, 403, or any non-2xx.
 *
 * @param {string} endpoint  Full URL, e.g. Config.CF_BASE + '/notesWrite'
 * @param {object} [body={}] Request payload (will be JSON-serialised)
 * @returns {Promise<object>} Parsed JSON response body
 */
async function cfPost(endpoint, body = {}) {
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`network error — ${e.message}`);
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 429) throw new Error("rate limited — try again later");
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok) throw new Error(data.error || `server error (${res.status})`);

  return data;
}

// Export to globalThis for modules loaded via new Function(src)()
globalThis.cfPost = cfPost;
