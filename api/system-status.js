import { getSystemStatus } from "./_lib/snapshots.js";

export default async function handler(_req, res) {
  const status = await getSystemStatus();
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  res.status(200).json({
    ...status,
    checkedAt: new Date().toISOString(),
  });
}
