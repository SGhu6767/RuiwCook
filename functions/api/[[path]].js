const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const OAUTH_STATE_MAX_AGE = 600; // 10 分钟，够走完 GitHub 授权流程

// 头像目前只提供预设表情，不接受任意上传（省掉图床/存储这一整套基础设施）。
// null 表示「默认灰色头像」。
const AVATAR_PRESETS = ["🍳", "🐱", "🐶", "🍜", "🍣", "🍰", "🦊", "🐼", "🍔", "🍕", "⭐", "🎮"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(";");

  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

function sessionCookie(token, maxAge = SESSION_DAYS * 24 * 60 * 60) {
  return [
    `ruiwcook_session=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

function oauthStateCookie(state, maxAge = OAUTH_STATE_MAX_AGE) {
  return [
    `ruiwcook_oauth_state=${encodeURIComponent(state)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function base64ToBytes(text) {
  return new Uint8Array(Buffer.from(text, "base64url"));
}

async function hashPassword(password, saltBytes) {
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 120000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );

  return bytesToBase64(new Uint8Array(bits));
}

async function createPasswordHash(password) {
  const salt = randomBytes(16);
  const hash = await hashPassword(password, salt);

  return {
    hash,
    salt: bytesToBase64(salt)
  };
}

async function verifyPassword(password, storedHash, storedSalt) {
  const salt = base64ToBytes(storedSalt);
  const hash = await hashPassword(password, salt);

  return hash === storedHash;
}

function randomPublicId() {
  const bytes = randomBytes(6);
  let id = "";
  for (const byte of bytes) {
    id += (byte % 36).toString(36);
  }
  return id.toUpperCase();
}

async function generatePublicId(db) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = randomPublicId();
    const exists = await db
      .prepare("SELECT id FROM users WHERE public_id = ? LIMIT 1")
      .bind(id)
      .first();
    if (!exists) return id;
  }
  throw new Error("无法生成唯一 ID，请重试");
}

function validUsername(username) {
  return /^[a-zA-Z0-9_\u4e00-\u9fff]{3,20}$/.test(username);
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 64;
}

async function createSession(db, userId) {
  const token = bytesToBase64(randomBytes(32));
  const now = Date.now();
  const expires = now + SESSION_MS;

  await db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind(token, userId, expires, now)
    .run();

  return token;
}

async function getUserFromSession(request, env) {
  const token = getCookie(request, "ruiwcook_session");

  if (!token) {
    return null;
  }

  const row = await env.DB.prepare(
    `SELECT
       users.id,
       users.username,
       users.money,
       users.ingredients,
       users.storage,
       users.cooked,
       users.public_id,
       users.nickname,
       users.avatar,
       users.bio,
       sessions.expires_at
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ?
     LIMIT 1`
  )
    .bind(token)
    .first();

  if (!row) {
    return null;
  }

  if (Number(row.expires_at) <= Date.now()) {
    await env.DB.prepare(
      "DELETE FROM sessions WHERE id = ?"
    )
      .bind(token)
      .run();

    return null;
  }

  // 老账号（迁移前注册的）第一次被读到时，顺便补上 public_id / 默认昵称。
  let publicId = row.public_id;
  let nickname = row.nickname;

  if (!publicId) {
    publicId = await generatePublicId(env.DB);
    nickname = nickname || publicId;

    await env.DB.prepare(
      "UPDATE users SET public_id = ?, nickname = ? WHERE id = ?"
    )
      .bind(publicId, nickname, row.id)
      .run();
  }

  return {
    id: row.id,
    username: row.username,
    money: Number(row.money),
    ingredients: JSON.parse(row.ingredients || "{}"),
    storage: JSON.parse(row.storage || "[]"),
    cooked: Number(row.cooked || 0),
    publicId,
    nickname: nickname || publicId,
    avatar: row.avatar || null,
    bio: row.bio || ""
  };
}

function publicUser(user) {
  return {
    id: user.id,
    publicId: user.publicId,
    nickname: user.nickname,
    avatar: user.avatar,
    bio: user.bio,
    money: user.money,
    ingredients: user.ingredients,
    storage: user.storage,
    cooked: user.cooked
  };
}

async function register(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "请求数据格式错误" }, 400);
  }

  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!validUsername(username)) {
    return json(
      {
        error: "用户名需要 3～20 个字符，只能使用中文、字母、数字或下划线"
      },
      400
    );
  }

  if (!validPassword(password)) {
    return json(
      {
        error: "密码需要 6～64 个字符"
      },
      400
    );
  }

  const exists = await env.DB.prepare(
    "SELECT id FROM users WHERE username = ? LIMIT 1"
  )
    .bind(username)
    .first();

  if (exists) {
    return json({ error: "这个用户名已经注册了" }, 409);
  }

  const passwordData = await createPasswordHash(password);
  const now = Date.now();

  const result = await env.DB.prepare(
    `INSERT INTO users
      (username, password_hash, password_salt, money, ingredients, storage, cooked, created_at)
     VALUES (?, ?, ?, 80, '{}', '[]', 0, ?)`
  )
    .bind(
      username,
      passwordData.hash,
      passwordData.salt,
      now
    )
    .run();

  const userId = result.meta.last_row_id;

  const token = await createSession(env.DB, userId);

  const user = await getUserFromSession(
    new Request(request.url, {
      headers: {
        Cookie: sessionCookie(token)
      }
    }),
    env
  );

  const response = json({
    ok: true,
    user: publicUser(user)
  });

  response.headers.set(
    "Set-Cookie",
    sessionCookie(token)
  );

  return response;
}

async function login(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "请求数据格式错误" }, 400);
  }

  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) {
    return json({ error: "请输入用户名和密码" }, 400);
  }

  const user = await env.DB.prepare(
    `SELECT
       id,
       username,
       password_hash,
       password_salt,
       money,
       ingredients,
       storage,
       cooked
     FROM users
     WHERE username = ?
     LIMIT 1`
  )
    .bind(username)
    .first();

  if (!user) {
    return json({ error: "用户名或密码错误" }, 401);
  }

  const correct = await verifyPassword(
    password,
    user.password_hash,
    user.password_salt
  );

  if (!correct) {
    return json({ error: "用户名或密码错误" }, 401);
  }

  const oldToken = getCookie(request, "ruiwcook_session");

  if (oldToken) {
    await env.DB.prepare(
      "DELETE FROM sessions WHERE id = ?"
    )
      .bind(oldToken)
      .run();
  }

  const token = await createSession(env.DB, user.id);

  const resultUser = await getUserFromSession(
    new Request(request.url, {
      headers: {
        Cookie: sessionCookie(token)
      }
    }),
    env
  );

  const response = json({
    ok: true,
    user: publicUser(resultUser)
  });

  response.headers.set(
    "Set-Cookie",
    sessionCookie(token)
  );

  return response;
}

async function logout(request, env) {
  const token = getCookie(request, "ruiwcook_session");

  if (token) {
    await env.DB.prepare(
      "DELETE FROM sessions WHERE id = ?"
    )
      .bind(token)
      .run();
  }

  const response = json({ ok: true });

  response.headers.set(
    "Set-Cookie",
    sessionCookie("", 0)
  );

  return response;
}

async function me(request, env) {
  const user = await getUserFromSession(request, env);

  if (!user) {
    return json({
      loggedIn: false
    });
  }

  return json({
    loggedIn: true,
    user: publicUser(user)
  });
}

async function saveGame(request, env) {
  const user = await getUserFromSession(request, env);

  if (!user) {
    return json({ error: "请先登录" }, 401);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "请求数据格式错误" }, 400);
  }

  const money = Number(body.money);

  const ingredients =
    body.ingredients &&
    typeof body.ingredients === "object"
      ? body.ingredients
      : {};

  const storage =
    Array.isArray(body.storage)
      ? body.storage
      : [];

  const cooked = Number.isFinite(Number(body.cooked))
    ? Math.max(0, Math.floor(Number(body.cooked)))
    : 0;

  if (!Number.isFinite(money) || money < 0 || money > 100000000) {
    return json({ error: "ri币数据无效" }, 400);
  }

  await env.DB.prepare(
    `UPDATE users
     SET money = ?,
         ingredients = ?,
         storage = ?,
         cooked = ?
     WHERE id = ?`
  )
    .bind(
      money,
      JSON.stringify(ingredients),
      JSON.stringify(storage),
      cooked,
      user.id
    )
    .run();

  return json({
    ok: true
  });
}

async function githubLoginStart(request, env) {
  if (!env.GITHUB_CLIENT_ID) {
    return json({ error: "GitHub 登录还没有配置（缺少 GITHUB_CLIENT_ID）" }, 500);
  }

  const url = new URL(request.url);
  const state = bytesToBase64(randomBytes(16));
  const redirectUri = `${url.origin}/api/auth/github/callback`;

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "read:user");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("allow_signup", "true");

  const response = new Response(null, {
    status: 302,
    headers: { Location: authorizeUrl.toString() }
  });

  response.headers.append("Set-Cookie", oauthStateCookie(state));

  return response;
}

async function githubLoginCallback(request, env) {
  const url = new URL(request.url);

  const failRedirect = (reason) => {
    const target = new URL("/", url.origin);
    target.searchParams.set("login_error", reason);
    const response = new Response(null, {
      status: 302,
      headers: { Location: target.toString() }
    });
    response.headers.append("Set-Cookie", oauthStateCookie("", 0));
    return response;
  };

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = getCookie(request, "ruiwcook_oauth_state");

  if (!code || !state || !savedState || state !== savedState) {
    return failRedirect("state");
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return failRedirect("config");
  }

  const redirectUri = `${url.origin}/api/auth/github/callback`;

  let accessToken;

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenRes.json();
    accessToken = tokenData && tokenData.access_token;
  } catch {
    accessToken = null;
  }

  if (!accessToken) {
    return failRedirect("token");
  }

  let profile;

  try {
    const profileRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RuiwCook",
        Accept: "application/vnd.github+json"
      }
    });

    if (!profileRes.ok) throw new Error("profile fetch failed");
    profile = await profileRes.json();
  } catch {
    return failRedirect("profile");
  }

  const githubId = String(profile.id);

  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE github_id = ? LIMIT 1"
  )
    .bind(githubId)
    .first();

  let userId;

  if (existing) {
    userId = existing.id;
  } else {
    const publicId = await generatePublicId(env.DB);
    // GitHub 登录的账号不需要密码，但 password_hash/salt 是 NOT NULL，
    // 所以用一段谁也猜不到的随机值占位，永远不会被用来验证。
    const placeholder = await createPasswordHash(bytesToBase64(randomBytes(24)));
    const now = Date.now();

    const result = await env.DB.prepare(
      `INSERT INTO users
        (username, password_hash, password_salt, money, ingredients, storage, cooked, created_at, github_id, public_id, nickname, avatar, bio)
       VALUES (?, ?, ?, 80, '{}', '[]', 0, ?, ?, ?, ?, NULL, '')`
    )
      .bind(
        `gh_${githubId}`,
        placeholder.hash,
        placeholder.salt,
        now,
        githubId,
        publicId,
        publicId
      )
      .run();

    userId = result.meta.last_row_id;
  }

  const oldToken = getCookie(request, "ruiwcook_session");

  if (oldToken) {
    await env.DB.prepare(
      "DELETE FROM sessions WHERE id = ?"
    )
      .bind(oldToken)
      .run();
  }

  const token = await createSession(env.DB, userId);

  const response = new Response(null, {
    status: 302,
    headers: { Location: `${url.origin}/` }
  });

  response.headers.append("Set-Cookie", sessionCookie(token));
  response.headers.append("Set-Cookie", oauthStateCookie("", 0));

  return response;
}

function validNickname(nickname) {
  return typeof nickname === "string" && nickname.trim().length >= 1 && nickname.trim().length <= 16;
}

function validBio(bio) {
  return typeof bio === "string" && bio.length <= 120;
}

async function updateProfile(request, env) {
  const user = await getUserFromSession(request, env);

  if (!user) {
    return json({ error: "请先登录" }, 401);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "请求数据格式错误" }, 400);
  }

  const nickname =
    typeof body.nickname === "string" ? body.nickname.trim() : user.nickname;

  const avatar =
    body.avatar === null || typeof body.avatar === "undefined"
      ? null
      : String(body.avatar);

  const bio = typeof body.bio === "string" ? body.bio : user.bio;

  if (!validNickname(nickname)) {
    return json({ error: "昵称需要 1～16 个字符" }, 400);
  }

  if (avatar !== null && !AVATAR_PRESETS.includes(avatar)) {
    return json({ error: "头像不可用" }, 400);
  }

  if (!validBio(bio)) {
    return json({ error: "简介最多 120 个字符" }, 400);
  }

  await env.DB.prepare(
    `UPDATE users
     SET nickname = ?,
         avatar = ?,
         bio = ?
     WHERE id = ?`
  )
    .bind(nickname, avatar, bio, user.id)
    .run();

  return json({
    ok: true,
    user: publicUser({ ...user, nickname, avatar, bio })
  });
}

async function cleanSessions(env) {
  await env.DB.prepare(
    "DELETE FROM sessions WHERE expires_at <= ?"
  )
    .bind(Date.now())
    .run();
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json(
      {
        error: "Cloudflare D1 数据库还没有绑定，请先配置 DB"
      },
      500
    );
  }

  await cleanSessions(env);

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/+/, "");

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": url.origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      }
    });
  }

  try {
    if (path === "api/register" && request.method === "POST") {
      return await register(request, env);
    }

    if (path === "api/login" && request.method === "POST") {
      return await login(request, env);
    }

    if (path === "api/logout" && request.method === "POST") {
      return await logout(request, env);
    }

    if (path === "api/me" && request.method === "GET") {
      return await me(request, env);
    }

    if (path === "api/save" && request.method === "POST") {
      return await saveGame(request, env);
    }

    if (path === "api/profile" && request.method === "POST") {
      return await updateProfile(request, env);
    }

    if (path === "api/auth/github" && request.method === "GET") {
      return await githubLoginStart(request, env);
    }

    if (path === "api/auth/github/callback" && request.method === "GET") {
      return await githubLoginCallback(request, env);
    }

    return json({ error: "API 不存在" }, 404);
  } catch (error) {
    console.error(error);

    return json(
      {
        error: "服务器发生错误"
      },
      500
    );
  }
}
