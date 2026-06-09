export const METRIC_KEYS = [
  "redirect_hit",
  "redirect_miss",
  "expired_hit",
  "disabled_hit",
  "api_conflict",
  "rate_limited",
  "created",
  "updated",
  "deleted",
  "private_denied",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export type StatsWindow = "minute" | "hour" | "day";

const WINDOW_SIZE_SEC: Record<StatsWindow, number> = {
  minute: 60,
  hour: 60 * 60,
  day: 60 * 60 * 24,
};

function bucketStartTs(now: number, window: StatsWindow): number {
  return Math.floor(now / (WINDOW_SIZE_SEC[window] * 1000)) * (WINDOW_SIZE_SEC[window] * 1000);
}

function metricKey(metric: MetricKey, window: StatsWindow, bucketStart: number): string {
  return `stats:${window}:${Math.floor(bucketStart / 1000)}:${metric}`;
}

function bucketEnds(window: StatsWindow, startTs: number): number {
  return startTs + WINDOW_SIZE_SEC[window] * 1000 - 1;
}

export async function incrementMetric(namespace: KVNamespace, metric: MetricKey, window: StatsWindow = "minute", retentionDays = 30): Promise<void> {
  const now = Date.now();
  const bucket = bucketStartTs(now, window);
  const key = metricKey(metric, window, bucket);
  const ttl = Math.max(1, retentionDays) * 24 * 60 * 60;
  const current = Number(await namespace.get(key)) || 0;
  await namespace.put(key, String(current + 1), { expirationTtl: ttl });
}

export async function getMetricWindowCount(namespace: KVNamespace, metric: MetricKey, window: StatsWindow, bucketStart: number): Promise<number> {
  const key = metricKey(metric, window, bucketStart);
  return Number(await namespace.get(key)) || 0;
}

export async function getStats(
  namespace: KVNamespace,
  window: StatsWindow,
  since = Date.now() - WINDOW_SIZE_SEC[window] * 1000,
  until = Date.now(),
): Promise<{
  window: StatsWindow;
  since: string;
  until: string;
  totals: Record<MetricKey, number>;
  buckets: Array<{ from: number; to: number; counts: Record<MetricKey, number> }>;
}> {
  const safeSince = Math.max(0, since);
  const safeUntil = Math.max(safeSince, until);
  const bucketSize = WINDOW_SIZE_SEC[window] * 1000;

  const startBucket = bucketStartTs(safeSince, window);
  const endBucket = bucketStartTs(safeUntil, window);

  const buckets: Array<{ from: number; to: number; counts: Record<MetricKey, number> }> = [];
  const totals: Record<MetricKey, number> = METRIC_KEYS.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<MetricKey, number>,
  );

  for (let bucket = startBucket; bucket <= endBucket; bucket += bucketSize) {
    const counts = {} as Record<MetricKey, number>;
    for (const key of METRIC_KEYS) {
      const value = await getMetricWindowCount(namespace, key, window, bucket);
      counts[key] = value;
      totals[key] += value;
    }

    buckets.push({
      from: bucket,
      to: bucketEnds(window, bucket),
      counts,
    });
  }

  return {
    window,
    since: new Date(safeSince).toISOString(),
    until: new Date(safeUntil).toISOString(),
    totals,
    buckets,
  };
}
