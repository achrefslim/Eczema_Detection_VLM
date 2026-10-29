// src/components/ReportsHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme, getColors } from '../context/ThemeContext';
import { getUserHistory, downloadReport, deleteReport, getReportDetail } from '../services/analysisService';
import AnalysisResults from './AnalysisResults';

// ── Severity badge config ────────────────────────────────────────────
const severityConfig = {
  Low:      { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)',  color: '#6EE7B7' },
  Moderate: { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)',  color: '#FCD34D' },
  High:     { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   color: '#FCA5A5' },
};

// ── Nav item ─────────────────────────────────────────────────────────
const NavItem = ({ icon, label, active, onClick, t }) => (
  <a onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
    borderRadius: 12, cursor: 'pointer', marginBottom: 4,
    background: active ? t.navActive : 'transparent',
    color: active ? t.navActiveText : t.navText,
    fontWeight: 500, fontSize: 15, textDecoration: 'none',
    transition: 'all 0.2s ease',
  }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.navHover; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
  >{icon}{label}</a>
);

// ── Delete confirmation dialog ───────────────────────────────────────
const DeleteDialog = ({ patientName, onConfirm, onCancel, t, isDark }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
    onClick={onCancel}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', damping: 20 }}
      onClick={e => e.stopPropagation()}
      style={{
        background: isDark ? '#13111f' : '#ffffff',
        border: `1px solid ${t.cardBdr}`,
        borderRadius: 20, padding: '36px 40px',
        maxWidth: 420, width: '90%',
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: 'rgba(239,68,68,0.12)',
        border: '1px solid rgba(239,68,68,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </div>
      <h3 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700, color: t.text, fontFamily: 'Syne, sans-serif' }}>
        Delete Report
      </h3>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: t.subtext, lineHeight: 1.65 }}>
        Are you sure you want to delete the report for <strong style={{ color: t.text }}>{patientName}</strong>?
        This action cannot be undone.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onCancel} style={{
          flex: 1, background: 'transparent',
          border: `1.5px solid ${t.inputBdr}`,
          borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 600,
          color: t.navText, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = t.navHover; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >Cancel</button>
        <button onClick={onConfirm} style={{
          flex: 1, background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          border: 'none', borderRadius: 12, padding: '12px',
          fontSize: 14, fontWeight: 600, color: 'white',
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 4px 16px rgba(239,68,68,0.35)',
          transition: 'opacity 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >Delete</button>
      </div>
    </motion.div>
  </motion.div>
);

// ── View Modal ───────────────────────────────────────────────────────
const ViewModal = ({ report, onClose, t, isDark }) => {
  // Build patientData object from the report row
  const patientData = {
    name:        report.patient_name  || 'Unknown',
    age:         report.patient_age   || '',
    ageUnit:     'years',
    duration:    report.problem_duration || '',
    description: report.description   || '',
  };

  // Build results object matching what AnalysisResults expects
  const results = {
    reportId:             report.id,
    diagnosis:            report.diagnosis            || 'Eczema Detected',
    diagnosisDescription: report.diagnosis_description || '',
    overallSeverity:      report.overall_severity     || 0,
    severityLabel:        report.severity_label       || 'Moderate',
    regions:              report.regions              || [],
    treatment:            report.treatment            || {},
    originalImageUrl:     report.originalImageUrl     || null,
    annotatedImageUrl:    report.annotatedImageUrl    || null,
    // Gemini sections
    treatmentSections:    report.gemini_sections?.treatmentSections || [],
    lifestyleAdvice:      report.gemini_sections?.lifestyleAdvice   || [],
    whenToSeeDoctor:      report.gemini_sections?.whenToSeeDoctor   || [],
    followUpSchedule:     report.gemini_sections?.followUpSchedule  || [],
    executiveSummary:     report.gemini_sections?.executiveSummary  || '',
    eczemaPhase:          report.gemini_sections?.eczemaPhase       || '',
    pdfAvailable:         report.pdfAvailable || false,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
        overflowY: 'auto',
        padding: '32px 20px',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 960, margin: '0 auto',
          background: isDark ? '#0e0c1a' : '#f5f7fa',
          border: `1px solid ${t.cardBdr}`,
          borderRadius: 24,
          padding: '36px 40px',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20,
          width: 38, height: 38, borderRadius: '50%',
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          border: `1px solid ${t.cardBdr}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: t.subtext, fontSize: 18,
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = t.subtext; }}
        >✕</button>

        <AnalysisResults
          results={results}
          patientData={patientData}
          onReset={onClose}
        />
      </motion.div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
const ReportsHistory = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { isDark } = useTheme();
  const t = getColors(isDark);

  const [history, setHistory]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [filter, setFilter]             = useState('All');

  // Modal / dialog state
  const [viewReport, setViewReport]     = useState(null);   // full report object for modal
  const [viewLoading, setViewLoading]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);   // {id, name} for confirm dialog
  const [deleting, setDeleting]         = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // ── Fetch history ──────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const res = await getUserHistory(currentUser.uid);
    setHistory(res.data || []);
    setLoading(false);
  }, [currentUser]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  // ── Filter logic ───────────────────────────────────────────────
  // MySQL stores severity_label: 'Low' | 'Moderate' | 'High'
  const filteredHistory = history.filter(item => {
    const name      = (item.patient_name  || '').toLowerCase();
    const diag      = (item.diagnosis     || '').toLowerCase();
    const query     = searchQuery.toLowerCase();
    const matchSearch = !searchQuery || name.includes(query) || diag.includes(query);
    const matchFilter = filter === 'All' || item.severity_label === filter;
    return matchSearch && matchFilter;
  });

  // ── View handler — fetches full report with images ─────────────
  const handleView = async (item) => {
    setViewLoading(true);
    // We need images — fetch full detail from backend
    const res = await getReportDetail(item.id);
    if (res.success) {
      setViewReport(res.data);
    } else {
      // Fallback: use what we already have (no images)
      setViewReport(item);
    }
    setViewLoading(false);
  };

  // ── Download handler ───────────────────────────────────────────
  const handleDownload = async (item, e) => {
    e.stopPropagation();
    setDownloadingId(item.id);
    await downloadReport(item.id, item.patient_name || 'patient');
    setDownloadingId(null);
  };

  // ── Delete handler ─────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Optimistically remove from UI immediately
    setHistory(prev => prev.filter(r => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
    // Then delete from backend in background
    await deleteReport(deleteTarget.id, currentUser.uid);
  };
  // ── Format date from MySQL created_at string ───────────────────
  const formatDate = (item) => {
    const raw = item.created_at || item.timestamp;
    if (!raw) return 'N/A';
    try {
      const d = new Date(raw);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return 'N/A'; }
  };

  const navIcons = {
    dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
    history:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    settings:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: t.pageBg, fontFamily: t.font,
      overflow: 'hidden', position: 'relative',
      transition: 'background 0.4s ease',
    }}>
      <style>{`
        @import url('${t.fontImport}');
        .record-card {
          background: ${t.card};
          border: 1px solid ${t.cardBdr};
          border-radius: 20px; overflow: hidden;
          transition: all 0.28s ease; cursor: default;
        }
        .record-card:hover {
          border-color: rgba(139,92,246,0.35);
          transform: translateY(-4px);
          box-shadow: 0 18px 44px rgba(0,0,0,0.18);
        }
        .filter-btn {
          padding: 8px 22px; border-radius: 9px; font-size: 14px;
          font-weight: 600; cursor: pointer; transition: all 0.2s ease;
          font-family: inherit;
        }
        .search-input {
          width: 100%; box-sizing: border-box;
          background: ${t.inputBg}; border: 1px solid ${t.inputBdr};
          border-radius: 12px; padding: 12px 16px 12px 44px;
          color: ${t.text}; font-size: 14px; font-family: inherit;
          outline: none; transition: border-color 0.2s;
        }
        .search-input:focus { border-color: rgba(139,92,246,0.5); }
        .search-input::placeholder { color: ${t.subtext}; }
        .action-btn {
          background: ${t.inputBg}; border: 1px solid ${t.inputBdr};
          border-radius: 10px; padding: 9px 0;
          color: ${t.subtext}; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          font-size: 13px; font-weight: 600; font-family: inherit;
          transition: all 0.2s ease;
        }
        .action-btn:hover { color: ${t.text}; }
        .action-btn.view:hover  { background: rgba(139,92,246,0.15); border-color: rgba(139,92,246,0.3); }
        .action-btn.dl:hover    { background: rgba(59,130,246,0.15);  border-color: rgba(59,130,246,0.3);  }
        .action-btn.del:hover   { background: rgba(239,68,68,0.15);   border-color: rgba(239,68,68,0.3);   color: #ef4444; }
      `}</style>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: t.blob1 }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: 500, height: 500, borderRadius: '50%', background: t.blob2 }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: isDark ? 0.025 : 0.04 }}>
          <defs><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke={isDark ? 'white' : '#667eea'} strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* ═══ SIDEBAR ═══ */}
      <aside style={{
        width: 230,
        background: t.sidebar, borderRight: `1px solid ${t.sidebarBdr}`,
        display: 'flex', flexDirection: 'column',
        padding: '28px 14px', position: 'fixed', left: 0, top: 0, height: '100vh',
        zIndex: 10, overflowY: 'auto',
        backdropFilter: 'blur(16px)', transition: 'background 0.4s ease',
      }}>
        <div style={{ padding: '0 6px', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, boxShadow: '0 4px 18px rgba(139,92,246,0.45)' }}>✦</div>
            <div>
              <div style={{ color: t.text, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>SkinSight</div>
              <div style={{ color: 'rgba(139,92,246,0.85)', fontSize: 10, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 2 }}>Analysis Pro</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <NavItem t={t} icon={navIcons.dashboard} label="Dashboard" onClick={() => navigate('/dashboard')} />
          <NavItem t={t} active icon={navIcons.history}   label="History"   onClick={() => navigate('/history')} />
          <NavItem t={t} icon={navIcons.settings}  label="Settings"  onClick={() => navigate('/settings')} />
        </nav>

        <div style={{ background: t.infoBg, border: `1px solid ${t.infoBdr}`, borderRadius: 16, padding: '18px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>AI-Powered Analysis</div>
          <div style={{ fontSize: 12.5, color: t.subtext, lineHeight: 1.65 }}>Advanced skin detection using state-of-the-art machine learning</div>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', position: 'relative', zIndex: 1, marginLeft: 230 }}>

        <motion.header
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          style={{
            padding: '22px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: `1px solid ${t.headerBdr}`, background: t.headerBg,
            backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100,
            transition: 'background 0.4s ease',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>Analysis History</h1>
            <p style={{ margin: '5px 0 0', color: t.subtext, fontSize: 13.5 }}>View and manage previous skin analysis reports</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={handleLogout}
              title="Logout"
              style={{
                width: 46, height: 46, borderRadius: '50%', border: 'none',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(59,130,246,0.22))'
                  : 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))',
                boxShadow: isDark
                  ? '0 0 0 1.5px rgba(139,92,246,0.35), 0 4px 18px rgba(139,92,246,0.18)'
                  : '0 0 0 1.5px rgba(139,92,246,0.25), 0 4px 18px rgba(139,92,246,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.25s ease',
                color: isDark ? 'rgba(200,180,255,0.9)' : '#7C3AED',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #8B5CF6, #3B82F6)';
                e.currentTarget.style.boxShadow = '0 0 0 1.5px rgba(139,92,246,0.5), 0 6px 24px rgba(139,92,246,0.38)';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isDark
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(59,130,246,0.22))'
                  : 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))';
                e.currentTarget.style.boxShadow = isDark
                  ? '0 0 0 1.5px rgba(139,92,246,0.35), 0 4px 18px rgba(139,92,246,0.18)'
                  : '0 0 0 1.5px rgba(139,92,246,0.25), 0 4px 18px rgba(139,92,246,0.12)';
                e.currentTarget.style.color = isDark ? 'rgba(200,180,255,0.9)' : '#7C3AED';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </motion.header>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '32px 40px 0' }}>
          {/* Search + Filters */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.subtext} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Search by patient name or diagnosis..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['All', 'Low', 'Moderate', 'High'].map(f => (
                <button key={f} className="filter-btn" onClick={() => setFilter(f)} style={{
                  background: filter === f ? 'linear-gradient(135deg, #8B5CF6, #3B82F6)' : t.inputBg,
                  color: filter === f ? 'white' : t.subtext,
                  border: filter === f ? '1px solid transparent' : `1px solid ${t.inputBdr}`,
                  boxShadow: filter === f ? '0 4px 15px rgba(139,92,246,0.3)' : 'none',
                }}>{f}</button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Cards grid ── */}
        <div style={{ padding: '0 40px', flex: 1 }}>

          {/* View loading overlay */}
          {viewLoading && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 350,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center', color: 'white' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8B5CF6', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ fontSize: 15, fontWeight: 600 }}>Loading report...</p>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: t.subtext }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
              <p style={{ fontSize: 15 }}>Loading history...</p>
            </div>

          ) : filteredHistory.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
              <h3 style={{ color: t.subtext, fontFamily: 'Syne, sans-serif', margin: '0 0 8px', fontSize: 20 }}>
                No records found
              </h3>
              <p style={{ color: t.mutedText, fontSize: 15 }}>
                {searchQuery || filter !== 'All'
                  ? 'Try adjusting your search or filters'
                  : 'Start by uploading a skin image for analysis'}
              </p>
              {!searchQuery && filter === 'All' && (
                <button onClick={() => navigate('/dashboard')} style={{
                  marginTop: 24, background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)',
                  color: 'white', border: 'none', padding: '12px 32px', borderRadius: 12,
                  fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 4px 16px rgba(139,92,246,0.35)',
                }}>Start Analysis</button>
              )}
            </motion.div>

          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, paddingBottom: 48 }}>
              {filteredHistory.map((item, i) => {
                // severity_label from MySQL: 'Low' | 'Moderate' | 'High'
                const sevKey = item.severity_label || 'Moderate';
                const sev    = severityConfig[sevKey] || severityConfig.Moderate;
                const date   = formatDate(item);
                const name   = item.patient_name || 'Unknown Patient';
                const isDownloading = downloadingId === item.id;

                return (
                  <motion.div
                    key={item.id || i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="record-card"
                  >
                    {/* ── Thumbnail ── */}
                    <div style={{ position: 'relative', height: 190, background: t.inputBg, overflow: 'hidden' }}>
                      {item.original_image_path ? (
                        <img
                          src={`http://localhost:5000/api/image/${item.id}`}
                          alt={item.patient_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.navActive }}>
                          <span style={{ fontSize: 40 }}>🔬</span>
                        </div>
                      )}
                      {/* Severity badge */}
                      <div style={{
                        position: 'absolute', top: 12, right: 12,
                        background: sev.bg, border: `1px solid ${sev.border}`,
                        borderRadius: 20, padding: '4px 13px',
                        fontSize: 11, fontWeight: 700, color: sev.color,
                        textTransform: 'uppercase', letterSpacing: 0.6,
                      }}>{sevKey}</div>
                    </div>

                    {/* ── Card info ── */}
                    <div style={{ padding: '18px 20px' }}>
                      <h3 style={{ color: t.text, fontFamily: 'Syne, sans-serif', fontSize: 16, margin: '0 0 5px', fontWeight: 700 }}>
                        {name}
                      </h3>
                      <p style={{ color: t.subtext, fontSize: 13.5, margin: '0 0 6px', lineHeight: 1.5 }}>
                        {item.diagnosis || 'Skin Analysis'}
                      </p>

                      {/* Age + duration chips */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        {item.patient_age && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#8B5CF6', background: 'rgba(139,92,246,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(139,92,246,0.2)' }}>
                            Age: {item.patient_age}
                          </span>
                        )}
                        {item.problem_duration && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: t.subtext, background: t.inputBg, padding: '3px 10px', borderRadius: 20, border: `1px solid ${t.inputBdr}` }}>
                            {item.problem_duration}
                          </span>
                        )}
                      </div>

                      {/* Date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.mutedText} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span style={{ fontSize: 12.5, color: t.mutedText }}>{date}</span>
                      </div>

                      {/* ── Action buttons ── */}
                      <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${t.cardBdr}`, paddingTop: 16 }}>
                        {/* View */}
                        <button className="action-btn view" style={{ flex: 1 }}
                          onClick={() => handleView(item)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          View
                        </button>

                        {/* Download PDF */}
                        <button className="action-btn dl" style={{ width: 40 }}
                          onClick={(e) => handleDownload(item, e)}
                          title="Download PDF"
                          disabled={isDownloading}
                        >
                          {isDownloading
                            ? <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(59,130,246,0.3)', borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite' }} />
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          }
                        </button>

                        {/* Delete */}
                        <button className="action-btn del" style={{ width: 40 }}
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: item.id, name }); }}
                          title="Delete report"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <footer style={{ padding: '20px 40px', borderTop: `1px solid ${t.headerBdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', background: t.headerBg, backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✦</div>
            <span style={{ fontSize: 12, color: t.subtext, fontWeight: 500 }}>SkinSight — Made with ❤ by the SkinSight Team</span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Privacy Policy', 'Terms of Service', 'Contact'].map(l => (
              <a key={l} style={{ fontSize: 12, color: t.subtext, textDecoration: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#8B5CF6'; }}
                onMouseLeave={e => { e.currentTarget.style.color = t.subtext; }}
              >{l}</a>
            ))}
          </div>
          <span style={{ fontSize: 12, color: t.subtext }}>© 2026 SkinSight AI. All rights reserved.</span>
        </footer>
      </div>

      {/* ═══ MODALS ═══ */}
      <AnimatePresence>
        {viewReport && (
          <ViewModal
            report={viewReport}
            onClose={() => setViewReport(null)}
            t={t}
            isDark={isDark}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteDialog
            patientName={deleteTarget.name}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
            t={t}
            isDark={isDark}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReportsHistory;
