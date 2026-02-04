/**
 * Redirect from /gimme to /sign-in with register tab selected.
 */

import { redirect } from "next/navigation";

/**
 * Redirect to sign-in page with register tab.
 */
export default function GimmePage() {
  redirect("/sign-in?tab=register");
}
