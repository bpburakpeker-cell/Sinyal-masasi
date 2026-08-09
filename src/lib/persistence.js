const LEGACY_KEYS = [
  "sm_stocks",
  "sm_targets",
  "sm_portfolio",
  "sm_net_targets",
  "sm_perf_snapshots",
  "sm_monthly_history",
  "sm_prediction_ledger",
];

function parseJson(raw, fallback) {
  try {
    return raw != null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function getOrCreateUserId() {
  const storage = getStorage();
  if (!storage) return null;
  const existing = storage.getItem("sm_user_id");
  if (existing) return existing;
  const created = globalThis.crypto?.randomUUID?.()
    || `sm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  storage.setItem("sm_user_id", created);
  return created;
}

export function defaultUserState(defaultStocks) {
  return {
    stocks: defaultStocks,
    targets: {},
    portfolio: {},
    netTargetSettings: {
      initialPrincipal: "",
      monthlyTargetPct: "",
      monthlyTargetTl: "",
      yearlyTargetPct: "",
      yearlyTargetTl: "",
      monthlyCostsTl: "",
      yearlyExtraCostsTl: "",
    },
    perfSnapshots: { months: {}, years: {} },
    monthlyHistory: {},
    predictionLedger: {},
  };
}

export function readLegacyUserState(defaultStocks) {
  const storage = getStorage();
  const defaults = defaultUserState(defaultStocks);
  if (!storage) return defaults;

  return {
    stocks: parseJson(storage.getItem("sm_stocks"), defaults.stocks),
    targets: parseJson(storage.getItem("sm_targets"), defaults.targets),
    portfolio: parseJson(storage.getItem("sm_portfolio"), defaults.portfolio),
    netTargetSettings: parseJson(storage.getItem("sm_net_targets"), defaults.netTargetSettings),
    perfSnapshots: parseJson(storage.getItem("sm_perf_snapshots"), defaults.perfSnapshots),
    monthlyHistory: parseJson(storage.getItem("sm_monthly_history"), defaults.monthlyHistory),
    predictionLedger: parseJson(storage.getItem("sm_prediction_ledger"), defaults.predictionLedger),
  };
}

export function cleanupLegacyUserState() {
  const storage = getStorage();
  if (!storage) return;
  LEGACY_KEYS.forEach((key) => storage.removeItem(key));
}

export function normalizeUserState(candidate, defaultStocks) {
  const defaults = defaultUserState(defaultStocks);
  if (!candidate || typeof candidate !== "object") return defaults;
  return {
    stocks: Array.isArray(candidate.stocks) && candidate.stocks.length ? candidate.stocks : defaults.stocks,
    targets: candidate.targets && typeof candidate.targets === "object" ? candidate.targets : defaults.targets,
    portfolio: candidate.portfolio && typeof candidate.portfolio === "object" ? candidate.portfolio : defaults.portfolio,
    netTargetSettings: candidate.netTargetSettings && typeof candidate.netTargetSettings === "object"
      ? { ...defaults.netTargetSettings, ...candidate.netTargetSettings }
      : defaults.netTargetSettings,
    perfSnapshots: candidate.perfSnapshots && typeof candidate.perfSnapshots === "object"
      ? { ...defaults.perfSnapshots, ...candidate.perfSnapshots }
      : defaults.perfSnapshots,
    monthlyHistory: candidate.monthlyHistory && typeof candidate.monthlyHistory === "object" ? candidate.monthlyHistory : defaults.monthlyHistory,
    predictionLedger: candidate.predictionLedger && typeof candidate.predictionLedger === "object" ? candidate.predictionLedger : defaults.predictionLedger,
  };
}

export function hasMeaningfulLegacyState(state, defaultStocks) {
  const defaults = defaultUserState(defaultStocks);
  return JSON.stringify(state) !== JSON.stringify(defaults);
}

export async function loadUserState(defaultStocks) {
  const userId = getOrCreateUserId();
  const legacyState = normalizeUserState(readLegacyUserState(defaultStocks), defaultStocks);

  if (!userId) {
    return { userId: null, remote: false, state: legacyState };
  }

  try {
    const response = await fetch(`/api/user-state?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const remoteState = normalizeUserState(payload?.state, defaultStocks);

    if (payload?.state) {
      cleanupLegacyUserState();
      return { userId, remote: true, state: remoteState };
    }

    if (hasMeaningfulLegacyState(legacyState, defaultStocks)) {
      await saveUserState(userId, legacyState);
      cleanupLegacyUserState();
      return { userId, remote: true, state: legacyState };
    }

    return { userId, remote: true, state: remoteState };
  } catch {
    return { userId, remote: false, state: legacyState };
  }
}

export async function saveUserState(userId, state) {
  if (!userId) return false;
  const response = await fetch("/api/user-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, state }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return true;
}
