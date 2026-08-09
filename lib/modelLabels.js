/**
 * Model etiketleri — UI ve api/signal.js tarafından kullanılır.
 */
export const MODEL_LABELS = {
  technical: {
    key:         "technical",
    label:       "Trend & Momentum Modeli",
    short:       "Trend",
    description: "Fiyat hareketini, işlem hacmini ve teknik göstergeleri (SMA/RSI/MACD/OBV) inceleyerek yön belirler.",
  },
  volatility: {
    key:         "volatility",
    label:       "Risk & Oynaklık Modeli",
    short:       "Risk",
    description: "Hissenin dalgalanma düzeyini GARCH modeliyle ölçüp piyasa rejimini (trend/yatay/oynak) belirler.",
  },
  relative_strength: {
    key:         "relative_strength",
    label:       "Göreli Güç Modeli",
    short:       "Göreli",
    description: "Hissenin sektör emsallerine (MGROS, SOKM vb.) kıyasla rölatif performansını ölçer.",
  },
};
