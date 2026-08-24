import { login } from './actions';

export const metadata = {
  title: 'Admin Login'
};

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
      <h1 className="text-xl font-bold">Admin login</h1>
      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Wrong password.
        </p>
      )}
      <form action={login} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? ''} />
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        />
        <button
          type="submit"
          className="rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Log in
        </button>
      </form>
    </div>
  );
}
