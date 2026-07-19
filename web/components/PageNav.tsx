import Link from "next/link";

type Dest = { href: string; label: string } | null;

export default function PageNav({ prev, next }: { prev?: Dest; next?: Dest }) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
      {prev ? (
        <Link
          href={prev.href}
          className="kicker text-bone-dim transition-colors hover:text-bone"
        >
          ← {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="kicker text-confirm transition-colors hover:text-bone"
        >
          {next.label} →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
