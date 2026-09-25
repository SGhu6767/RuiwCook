import { useState } from "react";
import type { AccountUser } from "./useAuth";
import { AVATAR_PRESETS } from "./avatars";

type Props = {
  user: AccountUser;
  onClose: () => void;
  onLogout: () => void;
  onUpdated: () => void;
};

/** 「我」页：头像 / 昵称 / ID / 简介，从底部弹出。 */
export default function Profile({ user, onClose, onLogout, onUpdated }: Props) {
  const [nickname, setNickname] = useState(user.nickname);
  const [bio, setBio] = useState(user.bio);
  const [avatar, setAvatar] = useState<string | null>(user.avatar);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = nickname !== user.nickname || bio !== user.bio || avatar !== user.avatar;

  async function save() {
    if (!dirty || saving) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, avatar, bio })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "保存失败，再试试");
        return;
      }

      onUpdated();
    } catch {
      setError("网络出错了，稍后再试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sheet-mask" onClick={onClose}>
      <section className="sheet profile-sheet" role="dialog" aria-label="我的资料" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <strong>我的资料</strong>
          <button className="sheet-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        <div className="sheet-body profile-body">
          <div className="profile-avatar-row">
            <button
              type="button"
              className="avatar-circle avatar-lg"
              onClick={() => setPickingAvatar((value) => !value)}
              aria-label="更换头像"
            >
              {avatar ?? ""}
            </button>
            <div className="profile-id">
              <div>ID：{user.publicId}</div>
              <small>点击头像可更换</small>
            </div>
          </div>

          {pickingAvatar && (
            <div className="avatar-grid">
              <button
                type="button"
                className={`avatar-circle${avatar === null ? " picked" : ""}`}
                onClick={() => setAvatar(null)}
                aria-label="默认灰色头像"
              />
              {AVATAR_PRESETS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`avatar-circle${avatar === item ? " picked" : ""}`}
                  onClick={() => setAvatar(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          <label className="profile-field">
            <span>昵称</span>
            <input value={nickname} maxLength={16} onChange={(event) => setNickname(event.target.value)} />
          </label>

          <label className="profile-field">
            <span>简介</span>
            <textarea
              value={bio}
              maxLength={120}
              placeholder="写点什么介绍一下自己吧"
              onChange={(event) => setBio(event.target.value)}
            />
          </label>

          {error && <p className="profile-error">{error}</p>}

          <div className="profile-stats">
            <div>💰 {user.money} ri币</div>
            <div>🍽️ 做过 {user.cooked} 道菜</div>
          </div>

          <button className="profile-save-btn" disabled={!dirty || saving} onClick={save}>
            {saving ? "保存中…" : "保存修改"}
          </button>

          <button className="profile-logout-btn" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </section>
    </div>
  );
}
