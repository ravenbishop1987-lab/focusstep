import supabase from "./supabase";

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export async function authFetch(input, init = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required");

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
