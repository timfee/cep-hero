/**
 * Redirect from /gimme to /sign-in page.
 */

import { redirect } from "next/navigation";

/**
 * Redirect to sign-in page.
 */
export default function GimmePage() {
  redirect("/sign-in");
}
