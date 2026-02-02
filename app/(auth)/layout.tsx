import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - CEP Hero",
  description: "Sign in to access your dashboard",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
