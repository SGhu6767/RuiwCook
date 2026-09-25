import { useCallback, useEffect, useState } from "react";

export type StoredDish = { name: string; value: number };

export type AccountUser = {
  id: number;
  publicId: string;
  nickname: string;
  avatar: string | null;
  bio: string;
  money: number;
  ingredients: Record<string, number>;
  storage: StoredDish[];
  cooked: number;
};

type AuthState = {
  loading: boolean;
  loggedIn: boolean;
  user: AccountUser | null;
};

/** 账号状态：拉取 /api/me，提供 GitHub 登录跳转和退出登录。 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ loading: true, loggedIn: false, user: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      const data = await res.json();

      if (data.loggedIn) {
        setState({ loading: false, loggedIn: true, user: data.user });
      } else {
        setState({ loading: false, loggedIn: false, user: null });
      }
    } catch {
      setState({ loading: false, loggedIn: false, user: null });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loginWithGithub = useCallback(() => {
    window.location.href = "/api/auth/github";
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } finally {
      setState({ loading: false, loggedIn: false, user: null });
    }
  }, []);

  return { ...state, refresh, loginWithGithub, logout };
}
