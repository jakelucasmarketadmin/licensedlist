/**
 * Owner and admin accounts. People sign in with a 6-digit code emailed to
 * them, so there are no passwords. Codes expire after 10 minutes and allow 5
 * tries; each address can request 5 codes an hour. Sessions last 30 days.
 * Only hashes of codes and session tokens are stored.
 */
import { getDb } from "./db";
import { ADMIN_EMAILS, SITE_NAME } from "@/lib/site";

export const SESSION_COOKIE = "ll_session";
const SESSION_DAYS = 30;
const CODE_MINUTES = 10;

export type Member = {
  _id: string;
  email: string;
  loginEmail: string;
  role: "owner" | "admin";
  contact: { emails: string[] };
  profile: { nickname: string };
};

export class AuthError extends Error {}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (text: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
const randomHex = (bytes: number) => hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
const later = (ms: number) => new Date(Date.now() + ms).toISOString();
export const cleanEmail = (v: unknown) => String(v ?? "").trim().toLowerCase().slice(0, 200);
const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const roleFor = (email: string): Member["role"] => (ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email) ? "admin" : "owner");

const toMember = (u: { id: string; email: string; role: string }): Member => ({
  _id: u.id,
  email: u.email,
  loginEmail: u.email,
  role: u.role === "admin" ? "admin" : "owner",
  contact: { emails: [u.email] },
  profile: { nickname: u.email.split("@")[0] },
});

async function sendCode(email: string, code: string, env: Record<string, any>, host: string) {
  const key = env.RESEND_API_KEY;
  if (!key) {
    // On this computer only, the code goes to the terminal so the flow can be tested without email.
    if (host === "localhost" || host === "127.0.0.1") { console.log(`[login] code for ${email}: ${code}`); return; }
    throw new AuthError("Sign-in email isn't set up yet. Please try again later.");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.LOGIN_EMAIL_FROM || `${SITE_NAME} <onboarding@resend.dev>`,
      to: [email],
      subject: `Your ${SITE_NAME} sign-in code: ${code}`,
      text: `Your ${SITE_NAME} sign-in code is ${code}\n\nIt works for ${CODE_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
    }),
  });
  if (!res.ok) {
    console.error("login email failed", res.status, await res.text().catch(() => ""));
    throw new AuthError("We couldn't send the email. Please try again in a minute.");
  }
}

export async function startLogin(rawEmail: unknown, env: Record<string, any>, host: string) {
  const email = cleanEmail(rawEmail);
  if (!isEmail(email)) throw new AuthError("Enter a valid email address.");
  const db = getDb();
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created > ?").bind(email, later(-3600_000)).first<{ n: number }>();
  if (Number(recent?.n ?? 0) >= 5) throw new AuthError("Too many codes requested. Wait an hour and try again.");
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  await db.prepare("INSERT INTO login_codes (email, code_hash, expires, attempts, created) VALUES (?, ?, ?, 0, ?)")
    .bind(email, await sha256(`${email}:${code}`), later(CODE_MINUTES * 60_000), new Date().toISOString()).run();
  await sendCode(email, code, env, host);
}

// Returns a new session token, after linking any claims made with this email.
export async function verifyLogin(rawEmail: unknown, rawCode: unknown): Promise<{ token: string; member: Member }> {
  const email = cleanEmail(rawEmail);
  const code = String(rawCode ?? "").replace(/\D/g, "");
  const db = getDb();
  const now = new Date().toISOString();
  const row = await db.prepare("SELECT rowid AS id, code_hash, attempts FROM login_codes WHERE email = ? AND expires > ? ORDER BY created DESC LIMIT 1").bind(email, now).first<{ id: number; code_hash: string; attempts: number }>();
  if (!row || row.attempts >= 5) throw new AuthError("That code has expired. Ask for a new one.");
  if (code.length !== 6 || (await sha256(`${email}:${code}`)) !== row.code_hash) {
    await db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE rowid = ?").bind(row.id).run();
    throw new AuthError("That code isn't right. Check the email and try again.");
  }
  await db.prepare("DELETE FROM login_codes WHERE email = ?").bind(email).run();

  const role = roleFor(email);
  let user = await db.prepare("SELECT id, email, role FROM users WHERE email = ?").bind(email).first<{ id: string; email: string; role: string }>();
  if (!user) {
    user = { id: crypto.randomUUID(), email, role };
    await db.prepare("INSERT INTO users (id, email, role, created, last_login) VALUES (?, ?, ?, ?, ?)").bind(user.id, email, role, now, now).run();
  } else {
    // The admin list in site.ts decides who is an admin, on every sign-in.
    await db.prepare("UPDATE users SET role = ?, last_login = ? WHERE id = ?").bind(role, now, user.id).run();
    user.role = role;
  }
  await linkClaims(user.id, email);

  const token = randomHex(32);
  await db.prepare("INSERT INTO sessions (token_hash, user_id, expires, created) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), user.id, later(SESSION_DAYS * 86400_000), now).run();
  return { token, member: toMember(user) };
}

// Claims submitted with this email (before the person had an account) become theirs.
export async function linkClaims(userId: string, email: string) {
  const db = getDb();
  const { results } = await db.prepare("SELECT id, data FROM items WHERE collection = 'claims' AND lower(json_extract(data, '$.claimantEmail')) = ? AND json_extract(data, '$.memberId') IS NULL").bind(email).all<{ id: string; data: string }>();
  for (const r of results) {
    const claim = { ...JSON.parse(r.data), memberId: userId };
    await db.prepare("UPDATE items SET data = ?, updated = ? WHERE collection = 'claims' AND id = ?").bind(JSON.stringify(claim), new Date().toISOString(), r.id).run();
  }
}

export async function memberFromCookie(cookieHeader: string | null): Promise<Member | null> {
  const token = /(?:^|;\s*)ll_session=([a-f0-9]{64})/.exec(cookieHeader || "")?.[1];
  if (!token) return null;
  const user = await getDb()
    .prepare("SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?")
    .bind(await sha256(token), new Date().toISOString())
    .first<{ id: string; email: string; role: string }>();
  return user ? toMember(user) : null;
}

export async function endSession(cookieHeader: string | null) {
  const token = /(?:^|;\s*)ll_session=([a-f0-9]{64})/.exec(cookieHeader || "")?.[1];
  if (token) await getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

export const sessionCookie = (token: string, secure: boolean) =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? "; Secure" : ""}`;
export const clearCookie = (secure: boolean) => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
