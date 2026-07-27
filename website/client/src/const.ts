export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Login real via Discord OAuth2 — o redirecionamento pro Discord e a troca
// de código por token acontecem no servidor (server/_core/oauth.ts).
export const getLoginUrl = (returnPath: string = window.location.pathname) => {
  const url = new URL("/api/oauth/login", window.location.origin);
  url.searchParams.set("returnTo", returnPath || "/");
  return url.toString();
};
