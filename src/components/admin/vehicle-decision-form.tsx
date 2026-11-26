"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function VehicleDecisionForm({ id, version, changeRequest = false, redirectOnApprove = false }: {
  id: string; version?: number; changeRequest?: boolean; redirectOnApprove?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    const status = fields.get("status");
    const reason = String(fields.get("reason") ?? "").trim();
    if (status === "rejected" && !reason) {
      setMessage("กรุณาระบุเหตุผลก่อนปฏิเสธ");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const resource = changeRequest ? "vehicle-changes" : "vehicle-reviews";
      const response = await fetch(`/api/admin/${resource}/${encodeURIComponent(id)}/decision`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, version, reason }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "บันทึกผลตรวจไม่สำเร็จ");
        return;
      }
      if (redirectOnApprove && status === "approved") router.replace("/admin/vehicle-approvals");
      else router.refresh();
    } catch {
      setMessage("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-3">
    <Label htmlFor="review-reason">หมายเหตุถึงผู้ยื่น</Label>
    <Textarea id="review-reason" name="reason" maxLength={1000} />
    <div className="admin-actions">
      <Button type="submit" name="status" value="approved" disabled={busy}>อนุมัติ</Button>
      <Button type="submit" name="status" value="rejected" variant="outline" disabled={busy}>ปฏิเสธ</Button>
    </div>
    {message && <p role="alert" className="text-sm text-primary">{message}</p>}
  </form>;
}
