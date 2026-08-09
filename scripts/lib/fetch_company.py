"""
Temel şirket verileri — api/_lib/providers.js'teki fetchCompanyPayload'ın
odaklı bir alt kümesi (sadece pipeline'ın kullanacağı trailing_pe ve
revenue_growth). Hata durumunda boş dict döner; pipeline'ı çökertmez.
"""
import requests

from .fetch_yahoo import HEADERS

MODULES = "summaryDetail,financialData"
URL = "https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}?modules={modules}"


def _raw(v):
    if v is None:
        return None
    if isinstance(v, dict) and "raw" in v:
        return v.get("raw")
    return v


def fetch_company_fundamentals(yahoo_symbol):
    """Döner: {"trailing_pe": float|None, "revenue_growth": float|None}.
    Herhangi bir hata durumunda ikisi de None olan bir dict döner."""
    try:
        resp = requests.get(
            URL.format(symbol=yahoo_symbol, modules=MODULES),
            headers=HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        result = (data.get("quoteSummary") or {}).get("result") or [None]
        result = result[0]
        if not result:
            return {"trailing_pe": None, "revenue_growth": None}

        summary = result.get("summaryDetail") or {}
        financial = result.get("financialData") or {}
        return {
            "trailing_pe": _raw(summary.get("trailingPE")),
            "revenue_growth": _raw(financial.get("revenueGrowth")),
        }
    except Exception:
        return {"trailing_pe": None, "revenue_growth": None}
