"use client";

import { useCallback, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  image?: string;
};

export type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
};

export type AuthActions = {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

export type UseAuthReturn = AuthState & AuthActions;

/**
 * Hook for managing authentication state with better-auth.
 * Provides user session data and sign-in/sign-out actions.
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const fetchSession = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const session = await authClient.getSession();

      if (session.data?.user) {
        setState({
          user: {
            id: session.data.user.id,
            email: session.data.user.email,
            name: session.data.user.name ?? undefined,
            image: session.data.user.image ?? undefined,
          },
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    } catch (err) {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error:
          err instanceof Error ? err : new Error("Failed to fetch session"),
      });
    }
  }, []);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err : new Error("Sign in failed"),
      }));
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      await authClient.signOut();
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err : new Error("Sign out failed"),
      }));
      throw err;
    }
  }, []);

  return {
    ...state,
    signInWithGoogle,
    signOut,
    refresh: fetchSession,
  };
}
