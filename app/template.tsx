"use client";

// Wraps every route. Next.js remounts this on each navigation, so it gives the
// whole app a gentle, consistent entrance transition between screens.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
