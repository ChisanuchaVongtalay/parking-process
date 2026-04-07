"use client";

export type MonitorSlotRow = {
  cameraSlotId: string;
  slotCode: string;
  score: number;
  occupied: boolean;
  updatedAt: string;
};

export function SlotResultTable(props: {
  title: string;
  rows: MonitorSlotRow[];
}) {
  const { title, rows } = props;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="max-h-72 overflow-auto rounded border border-slate-200">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-100 text-slate-700">
            <tr>
              <th className="px-2 py-1 text-left">Slot</th>
              <th className="px-2 py-1 text-left">Score</th>
              <th className="px-2 py-1 text-left">Occupied</th>
              <th className="px-2 py-1 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cameraSlotId} className="border-t border-slate-100">
                <td className="px-2 py-1 font-medium">{row.slotCode}</td>
                <td className="px-2 py-1">{row.score.toFixed(4)}</td>
                <td className="px-2 py-1">
                  {row.occupied ? (
                    <span className="font-semibold text-primary">true</span>
                  ) : (
                    <span className="font-semibold text-success">false</span>
                  )}
                </td>
                <td className="px-2 py-1 text-slate-500">
                  {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-2 py-2 text-slate-500" colSpan={4}>
                  No slot observation data.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
