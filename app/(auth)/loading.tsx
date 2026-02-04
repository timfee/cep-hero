export default function AuthLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 h-14 w-14 animate-pulse rounded-xl bg-muted" />
        <div className="mx-auto h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="mx-auto mt-2 h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="mx-auto mt-8 h-11 w-full animate-pulse rounded-md bg-muted" />
      </div>
    </main>
  );
}
