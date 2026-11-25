import Link from "next/link";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeading({ title, description, parent, actions }: {
  title: string;
  description: string;
  parent?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="admin-heading">
      <div>
        <div className="admin-crumb"><Link href="/admin">MFU Smart Parking</Link><span aria-hidden="true">/</span>{parent && <><Link href={parent.href}>{parent.label}</Link><span aria-hidden="true">/</span></>}<span>{title}</span></div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="admin-actions">{actions}</div>}
    </div>
  );
}

export function Panel({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return <section className="admin-panel"><header><h2>{title}</h2>{detail && <p>{detail}</p>}</header>{children}</section>;
}

export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return <div className="admin-notice"><Info size={19} aria-hidden="true" /><div><strong>{title}</strong><p>{children}</p></div></div>;
}

export function Status({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return <span className={`admin-status ${tone}`}>{children}</span>;
}

export function Stats({ items }: { items: { label: string; value: ReactNode; detail?: string; icon: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }[] }) {
  return <div className="admin-stats">{items.map(({ label, value, detail, icon, tone }) => (
    <section className="admin-stat" key={label}>
      <span className={`admin-stat-icon ${tone ?? ""}`} aria-hidden="true">{icon}</span>
      <h2>{label}</h2><strong>{value}</strong>{detail && <p>{detail}</p>}
    </section>
  ))}</div>;
}

export function DataTable({ headings, children }: { headings: string[]; children: ReactNode }) {
  return (
    <div className="admin-table-wrap" tabIndex={0} role="region" aria-label={headings.join(", ")}>
      <table className="admin-table"><thead><tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead><tbody>{children}</tbody></table>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="admin-empty"><strong>{title}</strong><p>{children}</p></div>;
}

export function ParkingStorageNotice() {
  return <Notice title="ยังไม่ได้เชื่อมข้อมูลลานจอด">
    สถานะช่องจอด กล้อง และผลจาก Snapshot Worker จะแสดงเมื่อเชื่อมระบบประมวลผลที่จอดรถ
  </Notice>;
}
