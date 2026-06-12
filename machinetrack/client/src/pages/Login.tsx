import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const { data: googleEnabled } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/google/enabled"],
  });

  const loginMut = useMutation({
    mutationFn: () =>
      api("/api/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      navigate("/");
    },
    onError: (err: any) => toast.error(err.message ?? "Login failed"),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm bg-card border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">MachineTrack</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        {googleEnabled?.enabled && (
          <a
            href="/api/auth/google"
            className="block w-full text-center px-4 py-2 border rounded-md hover:bg-muted text-sm font-medium"
          >
            Sign in with Google (Admin)
          </a>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or operator login</span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!identifier || !password) {
              toast.error("Enter username and password");
              return;
            }
            loginMut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Username or email</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loginMut.isPending}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
          >
            {loginMut.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
