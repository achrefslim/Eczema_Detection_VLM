// src/services/storage.js
// This file is kept so existing imports in Dashboard.js don't break.
// All real logic now lives in analysisService.js (backed by MySQL via Flask).

export { getUserHistory, deleteReport } from './analysisService';

// ─────────────────────────────────────────────
// saveAnalysisToHistory
// Called from Dashboard.js after a successful analysis.
// The backend already saved to MySQL inside /api/analyze,
// so this function is intentionally a no-op — it just
// returns success so the Dashboard doesn't throw.
// ─────────────────────────────────────────────
export const saveAnalysisToHistory = async (_userId, _data) => {
  // Data is already persisted by the backend during /api/analyze.
  // Nothing extra needed here.
  return { success: true };
};
