import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

type DiscordUserResponse = {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string | null;
  email?: string | null;
  verified?: boolean;
  avatar?: string | null;
};

export type UserInfo = {
  openId: string;
  name: string;
  email?: string | null;
  platform?: string | null;
  loginMethod?: string | null;
  discordId: string;
  discordUsername: string;
};

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_TOKEN_PATH = "/oauth2/token";
const DISCORD_USER_PATH = "/users/@me";

class DiscordOAuthService {
  constructor(private client: AxiosInstance) {
    if (!ENV.discordClientId || !ENV.discordClientSecret || !ENV.discordRedirectUri) {
      console.error(
        "[OAuth] ERROR: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET e DISCORD_REDIRECT_URI precisam estar configurados no .env"
      );
    }
  }

  private decodeState(state: string): string {
    try {
      return atob(state);
    } catch {
      return "/";
    }
  }

  buildAuthorizeUrl(returnPath: string = "/"): string {
    const state = btoa(returnPath || "/");
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", ENV.discordClientId);
    url.searchParams.set("redirect_uri", ENV.discordRedirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify email");
    url.searchParams.set("state", state);
    return url.toString();
  }

  decodeReturnPath(state: string | undefined): string {
    if (!state) return "/";
    const decoded = this.decodeState(state);
    // Só permite redirecionar pra paths internos (evita open-redirect)
    return decoded.startsWith("/") ? decoded : "/";
  }

  async exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
    const body = new URLSearchParams({
      client_id: ENV.discordClientId,
      client_secret: ENV.discordClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: ENV.discordRedirectUri,
    });

    const { data } = await this.client.post<DiscordTokenResponse>(
      DISCORD_TOKEN_PATH,
      body.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return data;
  }

  async getUserInfoByToken(accessToken: string): Promise<UserInfo> {
    const { data } = await this.client.get<DiscordUserResponse>(DISCORD_USER_PATH, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      openId: data.id,
      name: data.global_name || data.username,
      email: data.email ?? null,
      platform: "discord",
      loginMethod: "discord",
      discordId: data.id,
      discordUsername: data.username,
    };
  }
}

const createDiscordHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: DISCORD_API_BASE,
    timeout: 30_000,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: DiscordOAuthService;

  constructor(client: AxiosInstance = createDiscordHttpClient()) {
    this.client = client;
    this.oauthService = new DiscordOAuthService(this.client);
  }

  /**
   * Monta a URL de autorização do Discord pra onde o botão de login deve redirecionar.
   */
  getAuthorizeUrl(returnPath?: string): string {
    return this.oauthService.buildAuthorizeUrl(returnPath);
  }

  decodeReturnPath(state: string | undefined): string {
    return this.oauthService.decodeReturnPath(state);
  }

  /**
   * Troca o code do OAuth callback pelo access token do Discord.
   */
  async exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
    return this.oauthService.exchangeCodeForToken(code);
  }

  /**
   * Busca os dados do usuário logado no Discord usando o access token.
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    return this.oauthService.getUserInfoByToken(accessToken);
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Cria um token de sessão (JWT) pro openId (Discord user ID) informado.
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: "discord-bot-license-manager",
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  /**
   * Autentica a requisição a partir do cookie de sessão.
   * Diferente do fluxo antigo (Manus), não há como re-sincronizar o usuário
   * a partir só do JWT: o access token do Discord só existe durante o callback,
   * então o upsert acontece lá. Se o usuário não estiver no banco aqui, a sessão
   * é inválida e a pessoa precisa logar de novo.
   */
  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const signedInAt = new Date();
    const user = await db.getUserByOpenId(session.openId);

    if (!user) {
      throw ForbiddenError("User not found, please login again");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
