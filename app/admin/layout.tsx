import { ReactNode } from 'react';

// Internal tools live under /admin. Deliberately not linked from the storefront
// navbar or footer, and not indexed — direct URL access only.
export const metadata = {
  robots: { index: false, follow: false }
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="border-b border-neutral-300 bg-neutral-900 px-4 py-2 text-xs uppercase tracking-wide text-neutral-400 dark:border-neutral-800">
        Admin &mdash; internal tools, not part of the storefront
      </div>
      {children}
    </div>
  );
}
