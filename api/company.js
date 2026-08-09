function raw(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === "object" && "raw" in v) return v.raw ?? fallback;
  return v;
}

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) {
    res.status(400).json({ error: "symbol parametresi gerekli" });
    return;
  }

  const modules = [
    "assetProfile",
    "summaryDetail",
    "defaultKeyStatistics",
    "financialData",
    "price",
    "calendarEvents",
  ].join(",");

  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SinyalMasasi/1.0)",
        Accept: "application/json",
      },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Şirket verisi alınamadı: HTTP ${upstream.status}` });
      return;
    }

    const json = await upstream.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) {
      res.status(502).json({ error: "Şirket verisi boş döndü" });
      return;
    }

    const asset = result.assetProfile || {};
    const summary = result.summaryDetail || {};
    const stats = result.defaultKeyStatistics || {};
    const financial = result.financialData || {};
    const calendar = result.calendarEvents || {};
    const earningsDate = calendar?.earnings?.earningsDate?.[0];

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({
      symbol,
      sector: asset.sector || null,
      industry: asset.industry || null,
      businessSummary: asset.longBusinessSummary || null,
      fullTimeEmployees: raw(asset.fullTimeEmployees),
      officersCount: Array.isArray(asset.companyOfficers) ? asset.companyOfficers.length : 0,
      dividendYield: raw(summary.dividendYield),
      payoutRatio: raw(summary.payoutRatio),
      beta: raw(summary.beta),
      trailingPE: raw(summary.trailingPE),
      marketCap: raw(summary.marketCap) ?? raw(result.price?.marketCap),
      profitMargins: raw(financial.profitMargins),
      operatingMargins: raw(financial.operatingMargins),
      grossMargins: raw(financial.grossMargins),
      earningsGrowth: raw(financial.earningsGrowth),
      revenueGrowth: raw(financial.revenueGrowth),
      returnOnEquity: raw(financial.returnOnEquity),
      debtToEquity: raw(financial.debtToEquity),
      recommendationMean: raw(financial.recommendationMean),
      recommendationKey: financial.recommendationKey || null,
      numberOfAnalystOpinions: raw(financial.numberOfAnalystOpinions),
      currentPrice: raw(financial.currentPrice) ?? raw(result.price?.regularMarketPrice),
      targetMeanPrice: raw(financial.targetMeanPrice),
      targetHighPrice: raw(financial.targetHighPrice),
      targetLowPrice: raw(financial.targetLowPrice),
      totalCash: raw(financial.totalCash),
      totalDebt: raw(financial.totalDebt),
      earningsTimestamp: raw(earningsDate),
    });
  } catch (err) {
    res.status(502).json({ error: "Şirket verisi alınamadı: " + (err?.message || "bilinmeyen hata") });
  }
}
