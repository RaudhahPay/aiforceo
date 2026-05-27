import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }): Promise<React.ReactElement> {
  await requireAdmin();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="flex flex-col gap-6 p-5 shrink-0"
        style={{ width: 200, background: "var(--ink)", color: "#fff" }}
      >
        <Link href="/admin" className="flex items-center gap-2 font-bold text-sm text-white">
          <span className="logo-mark" />
          <span>
            Boardroom <span style={{ color: "var(--accent)" }}>AI</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 px-2 py-1">Admin</p>
          <NavLink href="/admin">Overview</NavLink>
          <NavLink href="/admin/customers">Customers</NavLink>
          <NavLink href="/admin/settings">Settings</NavLink>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-white min-h-screen">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
    >
      {children}
    </Link>
  );
}
