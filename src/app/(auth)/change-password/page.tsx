"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 12, label: "At least 12 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "At least one uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "At least one lowercase letter" },
  { test: (p: string) => /[0-9]/.test(p), label: "At least one number" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "At least one special character" },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const { update } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const allRulesPassed = PASSWORD_RULES.every((rule) => rule.test(newPassword));
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmit = allRulesPassed && passwordsMatch && currentPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to change password");
        return;
      }

      // Update session to clear mustChangePassword flag
      await update({ passwordChanged: true });

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
            BB
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Change Password</CardTitle>
        <CardDescription className="text-center">
          You must set a new password before continuing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current / Temporary Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-sm text-destructive">Passwords do not match</p>
            )}
          </div>

          {/* Password requirements checklist */}
          <div className="rounded-md border p-3 space-y-1.5">
            <p className="text-sm font-medium mb-2">Password requirements:</p>
            {PASSWORD_RULES.map((rule, i) => {
              const passed = rule.test(newPassword);
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={passed ? "text-green-600" : "text-muted-foreground"}>
                    {passed ? "\u2713" : "\u2022"}
                  </span>
                  <span className={passed ? "text-green-600" : "text-muted-foreground"}>
                    {rule.label}
                  </span>
                </div>
              );
            })}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit}
            loading={loading}
          >
            Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
