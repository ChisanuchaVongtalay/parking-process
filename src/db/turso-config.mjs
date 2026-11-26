const explicitUrl = "PARKING_TURSO_DATABASE_URL";
const explicitToken = "PARKING_TURSO_AUTH_TOKEN";
const integrationUrl = "TURSO_DATABASE_URL";
const integrationToken = "TURSO_AUTH_TOKEN";

export function hasTursoConfiguration() {
  return process.env[explicitUrl] !== undefined || process.env[explicitToken] !== undefined
    || Boolean(process.env[integrationUrl] || process.env[integrationToken]);
}

export function tursoConfiguration() {
  const explicit = process.env[explicitUrl] !== undefined || process.env[explicitToken] !== undefined;
  const [urlName, tokenName] = explicit ? [explicitUrl, explicitToken] : [integrationUrl, integrationToken];
  const url = process.env[urlName]?.trim();
  const authToken = process.env[tokenName]?.trim();
  if (!url || !authToken) throw new Error(`Set both ${urlName} and ${tokenName} for this deployment.`);
  return { url, authToken };
}
