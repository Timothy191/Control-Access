"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/approvals";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid username or password");
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <div className="w-full max-w-md glass-card">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded bg-red-primary flex items-center justify-center font-bold text-lg shadow-[0_0_15px_rgba(255,107,0,0.5)]">
            CA
          </div>
          <h2 className="text-2xl font-bold text-text-primary">
            CONTROL<span className="text-red-primary">-</span>ACCESS
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Username
            </label>
            <input
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-steel/30 rounded-md bg-black/40 text-text-primary placeholder:text-text-secondary"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Password
            </label>
            <input
              type="password"
              className="mt-1 block w-full px-3 py-2 border border-steel/30 rounded-md bg-black/40 text-text-primary placeholder:text-text-secondary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-primary text-white py-2 px-4 rounded hover:bg-red-dark disabled:opacity-50 transition"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
