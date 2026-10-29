// src/components/AnalysisResults.js
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, getColors } from '../context/ThemeContext';
import { downloadReport } from '../services/analysisService';

// ── Severity helpers ─────────────────────────────────────────────────
const getSeverityColor = (s) => {
  const v = parseFloat(s) || 0;
  if (v >= 8) return '#ef4444';
  if (v >= 6) return '#f97316';
  if (v >= 4) return '#eab308';
  return '#22c55e';
};
const getSeverityLabel = (s) => {
  const v = parseFloat(s) || 0;
  if (v >= 8) return 'Severe';
  if (v >= 6) return 'Moderate Severity';
  if (v >= 4) return 'Mild Severity';
  return 'Low Severity';
};
const getRegionScore = (region) => {
  if (!region) return 0;
  if (region.Severity?.score !== undefined) return parseFloat(region.Severity.score) || 0;
  if (region.severity !== undefined) return parseFloat(region.severity) || 0;
  return 0;
};

// ── Animated semi-circle gauge ───────────────────────────────────────
const SeverityGauge = ({ score100, color, isDark }) => {
  const r = 75;
  const circ = Math.PI * r;
  const pct = Math.min(Math.max(score100 / 100, 0), 1);
  const offset = circ * (1 - pct);
  const bg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <svg width="200" height="108" viewBox="0 0 200 108" style={{ display: 'block', margin: '0 auto' }}>
      <path d="M 25,100 A 75,75 0 0,1 175,100" fill="none" stroke={bg} strokeWidth="13" strokeLinecap="round"/>
      <path d="M 25,100 A 75,75 0 0,1 175,100" fill="none" stroke={color} strokeWidth="13" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)' }}/>
    </svg>
  );
};

// ── Section title component ──────────────────────────────────────────
const SectionTitle = ({ icon, label, t }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
    {icon}
    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text, fontFamily: 'Syne, sans-serif' }}>{label}</h3>
  </div>
);

// ── Bullet item ──────────────────────────────────────────────────────
const BulletItem = ({ text, color = '#8B5CF6', t }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 11 }}>
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 7 }} />
    <span style={{ fontSize: 14, color: t.text, lineHeight: 1.7 }}>{text}</span>
  </div>
);

// ── Treatment phase card ─────────────────────────────────────────────
const PhaseCard = ({ title, items, t, isDark, index }) => {
  const phaseColors = [
    { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)', dot: '#8B5CF6', label: '#8B5CF6' },
    { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', dot: '#3B82F6', label: '#3B82F6' },
    { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', dot: '#10B981', label: '#10B981' },
  ];
  const c = phaseColors[index % phaseColors.length];
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 16, padding: '20px 24px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: c.label, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14 }}>
        {title}
      </div>
      {items.map((item, i) => (
        <BulletItem key={i} text={item} color={c.dot} t={t} />
      ))}
    </div>
  );
};

// ── ABCDE helpers ────────────────────────────────────────────────────
const COLOR_SWATCH_MAP = {
  yellow: '#eab308', crust: '#ca8a04', brown: '#92400e', dark: '#44403c',
  red: '#ef4444', inflamed: '#f87171', white: '#d1d5db', depigmented: '#e5e7eb',
  pink: '#f472b6', erythema: '#fb7185', black: '#1c1917',
  purple: '#8b5cf6', blue: '#3b82f6', green: '#22c55e',
};
const swatchFor = (label) => {
  const l = label.toLowerCase();
  for (const [k, v] of Object.entries(COLOR_SWATCH_MAP)) {
    if (l.includes(k)) return v;
  }
  return '#6b7280';
};
const fmt2 = (v) =>
  v === undefined || v === null ? 'N/A' : typeof v === 'number' ? v.toFixed(2) : String(v);

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
const AnalysisResults = ({ results, patientData, onReset }) => {
  const { isDark } = useTheme();
  const t = getColors(isDark);
  const [downloading, setDownloading] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [showAllAbcde, setShowAllAbcde] = useState(false);

  if (!results) return null;

  // ── Map fields ──
  const originalImageUrl  = results.originalImageUrl  || null;
  const annotatedImageUrl = results.annotatedImageUrl || null;
  const overallSeverity   = parseFloat(results.overallSeverity ?? results.overall_severity ?? 0);
  const diagnosis         = results.diagnosis  || 'Eczema Detected';
  const diagnosisDesc     = results.diagnosisDescription || results.description || '';
  const regions           = Array.isArray(results.regions) ? results.regions : [];
  const reportId          = results.reportId || null;

  // Gemini sections
  const treatmentSections = Array.isArray(results.treatmentSections) ? results.treatmentSections : [];
  const lifestyleAdvice   = Array.isArray(results.lifestyleAdvice)   ? results.lifestyleAdvice   : [];
  const whenToSeeDoctor   = Array.isArray(results.whenToSeeDoctor)   ? results.whenToSeeDoctor   : [];
  const followUpSchedule  = Array.isArray(results.followUpSchedule)  ? results.followUpSchedule  : [];
  const executiveSummary  = results.executiveSummary || '';
  const eczemaPhase       = results.eczemaPhase || '';

  // ── Patient info ──
  const patientName  = patientData?.name     || patientData?.patientName  || 'Unknown';
  const patientAge   = patientData?.age      || patientData?.patientAge;
  const ageUnit      = patientData?.ageUnit  || 'years';
  const durationText = patientData?.duration || 'Unknown';
  const descText     = patientData?.description || '';
  const ageText      = patientAge ? `${patientAge} ${ageUnit} old` : 'Unknown';

  // ── Severity ──
  const score100      = overallSeverity > 10 ? Math.round(overallSeverity) : Math.round(overallSeverity * 10);
  const severityColor = getSeverityColor(overallSeverity);
  const severityLabel = getSeverityLabel(overallSeverity);

  const handleDownload = async () => {
    if (!reportId) return;
    setDownloading(true);
    await downloadReport(reportId, patientName);
    setDownloading(false);
  };

  // ── Styles ──
  const card = {
    background: t.card,
    border: `1px solid ${t.cardBdr}`,
    borderRadius: 20,
    backdropFilter: 'blur(12px)',
  };
  const barBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const barColors = ['#ec4899', '#f97316', '#a78bfa', '#3b82f6', '#10b981', '#eab308'];

  const images = [
    { label: 'Original Image', url: originalImageUrl },
    { label: 'Annotated View', url: annotatedImageUrl },
  ].filter(img => img.url);

  const visibleRegions = showAllRegions ? regions : regions.slice(0, 4);

  const svgIcon = (paths, color = '#8B5CF6') => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      style={{ fontFamily: t.font }}>

      {/* ══ HEADER ══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: 30, fontWeight: 700, color: t.text, fontFamily: 'Syne, sans-serif' }}>
            Analysis Results
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: t.subtext }}>AI-powered skin analysis for {patientName}</p>
        </div>
        {reportId && (
          <button onClick={handleDownload} disabled={downloading} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)',
            border: 'none', borderRadius: 12, padding: '12px 22px',
            fontSize: 14, fontWeight: 600, color: 'white',
            cursor: downloading ? 'not-allowed' : 'pointer',
            opacity: downloading ? 0.7 : 1, fontFamily: t.font,
            boxShadow: '0 4px 18px rgba(139,92,246,0.35)', transition: 'opacity 0.2s',
          }}
            onMouseEnter={e => { if (!downloading) e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = downloading ? '0.7' : '1'; }}
          >
            {svgIcon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>, 'white')}
            {downloading ? 'Downloading...' : 'Download Report'}
          </button>
        )}
      </div>

      {/* ══ PATIENT INFORMATION ══ */}
      <div style={{ ...card, padding: '26px 32px', marginBottom: 18 }}>
        <SectionTitle t={t} label="Patient Information"
          icon={svgIcon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 32px' }}>
          {[
            { label: 'Name',           value: patientName },
            { label: 'Age',            value: ageText },
            { label: 'Issue Duration', value: durationText },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: t.mutedText, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{value}</div>
            </div>
          ))}
        </div>
        {descText && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${t.cardBdr}` }}>
            <div style={{ fontSize: 11, color: t.mutedText, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 }}>Description</div>
            <div style={{ fontSize: 14, color: t.subtext, lineHeight: 1.7 }}>{descText}</div>
          </div>
        )}
      </div>

      {/* ══ IMAGES — 2 big side-by-side with tab switcher on mobile ══ */}
      {images.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          {/* Tab buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {images.map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)} style={{
                padding: '7px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: t.font, transition: 'all 0.2s',
                background: activeImg === i ? 'linear-gradient(135deg, #8B5CF6, #3B82F6)' : t.featureCard,
                color: activeImg === i ? 'white' : t.subtext,
                border: activeImg === i ? 'none' : `1px solid ${t.cardBdr}`,
                boxShadow: activeImg === i ? '0 4px 14px rgba(139,92,246,0.3)' : 'none',
              }}>{img.label}</button>
            ))}
          </div>

          {/* Image display — side by side on wide screens, tabbed on narrow */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {images.map(({ label, url }, i) => (
              <div key={label} style={{
                ...card, padding: '14px 14px 12px',
                display: images.length === 1 || true ? 'block' : (activeImg === i ? 'block' : 'none'),
              }}>
                <div style={{ fontSize: 12, color: t.subtext, marginBottom: 10, fontWeight: 600, letterSpacing: 0.3 }}>{label}</div>
                <img src={url} alt={label} style={{
                  width: '100%', height: 320, objectFit: 'contain',
                  borderRadius: 14, display: 'block',
                  background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ DIAGNOSIS + SEVERITY (side by side) ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>

        {/* Diagnosis */}
        <div style={{ ...card, padding: '26px 28px' }}>
          <SectionTitle t={t} label="Diagnosis"
            icon={svgIcon(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>{diagnosis}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'rgba(139,92,246,0.18)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
              Primary
            </span>
          </div>
          {diagnosisDesc && (
            <p style={{ margin: '0 0 18px', fontSize: 13, color: t.subtext, lineHeight: 1.7 }}>{diagnosisDesc}</p>
          )}
          {eczemaPhase && (
            <div style={{ background: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.05)', border: `1px solid rgba(139,92,246,0.15)`, borderRadius: 12, padding: '12px 16px', marginBottom: 18, fontSize: 13, color: t.subtext, lineHeight: 1.65 }}>
              {eczemaPhase}
            </div>
          )}

          {/* All region severity bars */}
          {regions.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: t.mutedText, marginBottom: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Region Severity — {regions.length} Detected
              </div>
              {visibleRegions.map((region, i) => {
                const score = getRegionScore(region);
                const pct   = Math.round(score * 10);
                const label = `Region ${region.region_index ?? i + 1}`;
                const color = barColors[i % barColors.length];
                const sevText = region.Severity?.severity || getSeverityLabel(score).split(' ')[0];
                return (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 12, color: t.subtext }}>{score.toFixed(2)}/10 — {sevText}</span>
                    </div>
                    <div style={{ height: 8, background: barBg, borderRadius: 5, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
                        style={{ height: '100%', background: color, borderRadius: 5 }}
                      />
                    </div>
                  </div>
                );
              })}
              {regions.length > 4 && (
                <button onClick={() => setShowAllRegions(v => !v)} style={{
                  background: 'none', border: `1px solid ${t.cardBdr}`, borderRadius: 8,
                  padding: '6px 16px', fontSize: 12, fontWeight: 600, color: '#8B5CF6',
                  cursor: 'pointer', fontFamily: t.font, marginTop: 4,
                }}>
                  {showAllRegions ? 'Show Less' : `Show All ${regions.length} Regions`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Severity gauge */}
        <div style={{ ...card, padding: '26px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <SectionTitle t={t} label="Severity Score"
            icon={svgIcon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>)}
          />
          <SeverityGauge score100={score100} color={severityColor} isDark={isDark} />
          <div style={{ fontSize: 46, fontWeight: 800, color: t.text, fontFamily: 'Syne, sans-serif', marginTop: 6, lineHeight: 1 }}>
            {score100}
            <span style={{ fontSize: 22, fontWeight: 500, color: t.subtext }}>/100</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <span style={{
              fontSize: 13, fontWeight: 700, padding: '6px 18px', borderRadius: 20,
              background: `${severityColor}22`, color: severityColor,
              border: `1px solid ${severityColor}44`,
            }}>{severityLabel}</span>
          </div>
          {executiveSummary && (
            <p style={{ marginTop: 20, fontSize: 12.5, color: t.subtext, lineHeight: 1.7, textAlign: 'left', borderTop: `1px solid ${t.cardBdr}`, paddingTop: 16 }}>
              {executiveSummary.length > 280 ? executiveSummary.slice(0, 280) + '…' : executiveSummary}
            </p>
          )}
        </div>
      </div>

      {/* ══ ABCDE CLINICAL ANALYSIS ══ */}
      {regions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{ ...card, padding: '26px 32px', marginBottom: 18 }}
        >
          <SectionTitle t={t} label="ABCDE Clinical Analysis"
            icon={
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/>
              </svg>
            }
          />

          {(showAllAbcde ? regions : regions.slice(0, 3)).map((region, ri) => {
            const score = getRegionScore(region);
            const sevColor = score >= 8 ? '#ef4444' : score >= 6 ? '#f97316' : score >= 4 ? '#eab308' : '#22c55e';
            const sevLabel = region.Severity?.severity || (score >= 8 ? 'Severe' : score >= 6 ? 'Moderate' : score >= 4 ? 'Mild' : 'Low');
            const regionNum = region.region_index ?? ri + 1;
            const A  = region.A_Asymmetry   || {};
            const B  = region.B_Border      || {};
            const C  = region.C_Color       || {};
            const D  = region.D_Diameter    || {};
            const Tx = region.Texture_Bonus || {};
            const E  = region.E_Evolution   || {};

            const criteria = [
              {
                letter: 'A', color: '#8B5CF6', label: 'Asymmetry',
                main: A.label || 'N/A',
                subs: [
                  { k: 'Horizontal', v: fmt2(A.horizontal_asymmetry) },
                  { k: 'Vertical',   v: fmt2(A.vertical_asymmetry)   },
                ],
              },
              {
                letter: 'B', color: '#3B82F6', label: 'Border',
                main: B.label || 'N/A',
                subs: [
                  { k: 'Circularity', v: fmt2(B.circularity)      },
                  { k: 'Convexity',   v: fmt2(B.convexity_ratio)  },
                ],
              },
              {
                letter: 'C', color: '#ec4899', label: 'Color',
                main: C.label || 'N/A',
                colorPills: Array.isArray(C.colors_detected) ? C.colors_detected : [],
                subs: [{ k: 'Variation σ', v: fmt2(C.color_variation_std) }],
              },
              {
                letter: 'D', color: '#f97316', label: 'Diameter',
                main: D.label || 'N/A',
                subs: [
                  { k: 'Est. Diameter', v: D.estimated_diameter_px !== undefined ? `${Math.round(D.estimated_diameter_px)} px` : 'N/A' },
                  { k: 'Fill Ratio',    v: fmt2(D.fill_ratio)                                                                           },
                ],
              },
              {
                letter: 'T', color: '#14b8a6', label: 'Texture',
                main: Tx.label || 'N/A',
                subs: [
                  { k: 'Roughness',     v: fmt2(Tx.roughness_index) },
                  { k: 'GLCM Contrast', v: fmt2(Tx.glcm_contrast)   },
                ],
              },
              {
                letter: 'E', color: '#22c55e', label: 'Evolution',
                main: E.label || 'N/A',
                subs: [],
              },
            ];

            return (
              <div key={ri} style={{
                borderTop: ri > 0 ? `1px solid ${t.cardBdr}` : 'none',
                paddingTop: ri > 0 ? 22 : 0,
                marginTop: ri > 0 ? 22 : 0,
              }}>
                {/* Region header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: 'Syne, sans-serif' }}>
                    Region {regionNum}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
                    background: `${sevColor}22`, color: sevColor, border: `1px solid ${sevColor}44`,
                  }}>
                    {score.toFixed(2)} / 10 — {sevLabel}
                  </span>
                </div>

                {/* Criteria grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  {criteria.map(({ letter, color, label, main, subs, colorPills }) => (
                    <div key={letter} style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${t.cardBdr}`,
                      borderRadius: 14, padding: '14px 16px',
                    }}>
                      {/* Letter badge + criterion name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: `${color}20`, border: `1.5px solid ${color}55`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: 'Syne, sans-serif' }}>{letter}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: t.mutedText }}>{label}</span>
                      </div>

                      {/* Main label */}
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: (colorPills && colorPills.length > 0) || subs.length > 0 ? 8 : 0 }}>
                        {main}
                      </div>

                      {/* Color pills (C criterion) */}
                      {colorPills && colorPills.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: subs.length > 0 ? 8 : 0 }}>
                          {colorPills.map((cp, ci) => {
                            const sw = swatchFor(cp);
                            return (
                              <div key={ci} style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                background: `${sw}25`, border: `1px solid ${sw}55`,
                                borderRadius: 8, padding: '2px 8px',
                              }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: sw, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: t.subtext, fontWeight: 500 }}>{cp}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Sub-values */}
                      {subs.map(({ k, v }) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: t.mutedText, fontWeight: 600 }}>{k}</span>
                          <span style={{ fontSize: 13, color: t.subtext, fontWeight: 500 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Show all / show less toggle */}
          {regions.length > 3 && (
            <div style={{ textAlign: 'center', marginTop: 22 }}>
              <button onClick={() => setShowAllAbcde(v => !v)} style={{
                background: 'none', border: `1px solid ${t.cardBdr}`, borderRadius: 10,
                padding: '8px 22px', fontSize: 13, fontWeight: 600, color: '#8B5CF6',
                cursor: 'pointer', fontFamily: t.font, transition: 'all 0.2s',
              }}>
                {showAllAbcde ? 'Show Less' : `Show All ${regions.length} Regions`}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ══ TREATMENT RECOMMENDATIONS ══ */}
      {treatmentSections.length > 0 && (
        <div style={{ ...card, padding: '26px 32px', marginBottom: 18 }}>
          <SectionTitle t={t} label="Treatment Recommendations"
            icon={svgIcon(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>, '#22c55e')}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {treatmentSections.map((sec, i) => (
              <PhaseCard key={i} title={sec.title} items={sec.items} t={t} isDark={isDark} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ══ LIFESTYLE ADVICE + WHEN TO SEE DOCTOR (side by side) ══ */}
      {(lifestyleAdvice.length > 0 || whenToSeeDoctor.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: lifestyleAdvice.length > 0 && whenToSeeDoctor.length > 0 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 18 }}>

          {lifestyleAdvice.length > 0 && (
            <div style={{ ...card, padding: '26px 28px' }}>
              <SectionTitle t={t} label="Lifestyle & Prevention"
                icon={svgIcon(<><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>, '#ec4899')}
              />
              {lifestyleAdvice.map((item, i) => (
                <BulletItem key={i} text={item} color="#ec4899" t={t} />
              ))}
            </div>
          )}

          {whenToSeeDoctor.length > 0 && (
            <div style={{ ...card, padding: '26px 28px' }}>
              <SectionTitle t={t} label="When to See a Doctor"
                icon={svgIcon(<><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>, '#ef4444')}
              />
              <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
                Seek medical attention immediately if you notice:
              </div>
              {whenToSeeDoctor.map((item, i) => (
                <BulletItem key={i} text={item} color="#ef4444" t={t} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ FOLLOW-UP SCHEDULE ══ */}
      {followUpSchedule.length > 0 && (
        <div style={{ ...card, padding: '22px 32px', marginBottom: 18 }}>
          <SectionTitle t={t} label="Follow-Up Schedule"
            icon={svgIcon(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>)}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {followUpSchedule.map((item, i) => (
              <BulletItem key={i} text={item} color="#3b82f6" t={t} />
            ))}
          </div>
        </div>
      )}

      {/* ══ DISCLAIMER ══ */}
      <div style={{
        background: isDark ? 'rgba(139,92,246,0.07)' : 'rgba(139,92,246,0.05)',
        border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 14, padding: '16px 22px', marginBottom: 28,
      }}>
        <p style={{ margin: 0, fontSize: 12.5, color: t.subtext, lineHeight: 1.75 }}>
          <strong style={{ color: t.text }}>Note:</strong>{' '}
          This AI analysis is for informational purposes only. It does not replace a formal in-person physical examination by a licensed physician. Always seek the advice of your dermatologist or other qualified health provider with any questions you may have regarding a medical condition.
        </p>
      </div>

      {/* ══ NEW ANALYSIS ══ */}
      <div style={{ textAlign: 'center', paddingBottom: 8 }}>
        <button onClick={onReset} style={{
          background: 'transparent', border: `1.5px solid ${t.inputBdr}`,
          borderRadius: 12, padding: '13px 44px',
          fontSize: 15, fontWeight: 600, color: t.navText,
          cursor: 'pointer', fontFamily: t.font, transition: 'all 0.2s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = t.navHover; e.currentTarget.style.color = t.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.navText; }}
        >
          New Analysis
        </button>
      </div>
    </motion.div>
  );
};

export default AnalysisResults;
