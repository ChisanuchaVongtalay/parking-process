import { CameraManager } from "@/components/admin/camera-manager";

export default function CamerasPage() {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold">Camera Management</h2>
      <p className="text-sm text-slate-600">Register cameras and open calibration workspace.</p>
      <CameraManager />
    </div>
  );
}
