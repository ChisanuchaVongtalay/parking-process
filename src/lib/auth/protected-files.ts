export function isStoredImagePath(path: string, directory: "snapshots" | "backgrounds") {
  const [root, ...parts] = path.split("/");
  return root === directory && parts.length > 0 &&
    parts.every((part) => /^[a-z0-9_-][a-z0-9_.-]*$/i.test(part)) &&
    /\.(?:png|jpe?g)$/i.test(parts[parts.length - 1]);
}

export function isDownloadableDataFile(path: string) {
  return isStoredImagePath(path, "snapshots") || isStoredImagePath(path, "backgrounds") ||
    /^exports\/[a-z0-9_-][a-z0-9_.-]*\.json$/i.test(path);
}
