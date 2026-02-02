import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - CEP Command Center",
  description: "Sign in to access Chrome Enterprise Premium diagnostics",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
