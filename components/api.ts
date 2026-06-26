// Tiny client fetch helpers.

export async function jget<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  return r.json();
}

export async function jpost<T = any>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
}
