const formatTime = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Bangkok",
});

export function adminTime(value: number | Date | null | undefined) {
  return value == null ? "—" : formatTime.format(value);
}
