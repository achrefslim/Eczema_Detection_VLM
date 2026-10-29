// src/components/UserGuide.js
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TW  = 300;  // tooltip width
const TH  = 200;  // estimated tooltip height (used for flip logic)
const GAP = 14;   // gap between spotlight edge and tooltip

// tipTop / tipLeft: per-step overrides for tooltip position when the default
// calculation would place it oddly (e.g. full-height sidebar, or nav items
// that are inside the sidebar so cx gets clamped to the left edge).
const STEPS = [
  { id: 'welcome',  title: 'Welcome to SkinSight AI!', desc: 'Quick tour of the platform, takes less than a minute.',          targetId: null,                pos: 'center' },
  { id: 'sidebar',  title: 'Sidebar Navigation',        desc: 'Switch between Dashboard, History, and Settings here.',         targetId: 'guide-sidebar',     pos: 'right',  tipTop: 155 },
  { id: 'stepper',  title: '3-Step Workflow',           desc: 'Upload Image, fill Patient Info, then receive AI Results.',     targetId: 'guide-stepper',     pos: 'bottom' },
  { id: 'upload',   title: 'Upload Skin Image',         desc: 'Drag and drop or click to upload a JPG/PNG photo (max 10 MB).', targetId: 'guide-upload-card', pos: 'top'    },
  { id: 'history',  title: 'Analysis History',          desc: 'Every completed analysis is saved here automatically.',         targetId: 'guide-nav-history', pos: 'bottom', tipLeft: 244 },
  { id: 'guide',    title: 'Reopen This Guide',         desc: 'Click this button anytime to come back to this walkthrough.',   targetId: 'guide-help-btn',    pos: 'bottom' },
  { id: 'done',     title: "You're all set!",            desc: 'Upload a skin image to run your first AI analysis.',            targetId: null,                pos: 'center' },
];

const UserGuide = ({ isOpen, onClose, isDark, t }) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const cur = STEPS[step];

  const measure = useCallback(() => {
    if (!cur.targetId) { setRect(null); setReady(true); return; }
    const el = document.getElementById(cur.targetId);
    if (!el)           { setRect(null); setReady(true); return; }

    setReady(false);
    const initial = el.getBoundingClientRect();
    const inView  = initial.top >= 0 && initial.bottom <= window.innerHeight;

    const snap = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setReady(true);
    };

    if (inView) {
      snap();
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(snap, 500);
    }
  }, [cur.targetId]);

  useEffect(() => {
    if (!isOpen) { setStep(0); setRect(null); return; }
    measure();
  }, [step, isOpen, measure]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isOpen, measure]);

  const getPos = () => {
    if (!rect || cur.pos === 'center') {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Default centers — overridden per-step when needed
    const defaultCx = Math.max(8, Math.min(vw - TW - 8, rect.left + rect.width  / 2 - TW / 2));
    const defaultCy = Math.max(8, Math.min(vh - TH - 8, rect.top  + rect.height / 2 - TH / 2));
    const cx = cur.tipLeft !== undefined ? cur.tipLeft : defaultCx;
    const cy = cur.tipTop  !== undefined ? cur.tipTop  : defaultCy;

    // Auto-flip when preferred side overflows the viewport
    let p = cur.pos;
    if (p === 'right'  && rect.right  + GAP + TW > vw - 8) p = 'left';
    if (p === 'left'   && rect.left   - GAP - TW < 8)      p = 'right';
    if (p === 'bottom' && rect.bottom + GAP + TH > vh - 8) p = 'top';
    if (p === 'top'    && rect.top    - GAP - TH < 8)      p = 'bottom';

    const base = { position: 'fixed', zIndex: 9999, width: TW };
    switch (p) {
      case 'right':  return { ...base, top: cy,                                       left: rect.right + GAP };
      case 'left':   return { ...base, top: cy,                                       left: rect.left - TW - GAP };
      case 'bottom': return { ...base, top: Math.min(vh - TH - 8, rect.bottom + GAP), left: cx };
      case 'top':    return { ...base, top: Math.max(8, rect.top - TH - GAP),         left: cx };
      default:       return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  if (!isOpen) return null;

  const SP = 8;

  return (
    <>
      {/* Overlay / Spotlight */}
      <AnimatePresence mode="wait">
        {(!ready || !rect) ? (
          <motion.div key="ov"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9990, backdropFilter: 'blur(2px)' }}
          />
        ) : (
          <motion.div key={`sp${step}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              top: rect.top - SP,  left: rect.left - SP,
              width: rect.width + SP * 2,  height: rect.height + SP * 2,
              borderRadius: 14,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
              zIndex: 9990,
              pointerEvents: 'none',
              border: '2px solid rgba(139,92,246,0.9)',
              outline: '4px solid rgba(139,92,246,0.15)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div key={`tp${step}`}
          initial={{ opacity: 0, scale: 0.93, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
          style={{
            ...getPos(),
            zIndex: 9999,
            width: TW,
            background: isDark
              ? 'linear-gradient(148deg, rgba(12,7,30,0.98), rgba(18,11,46,0.98))'
              : 'linear-gradient(148deg, rgba(255,255,255,0.99), rgba(246,242,255,0.99))',
            border: '1px solid rgba(139,92,246,0.42)',
            borderRadius: 18,
            padding: '18px',
            boxShadow: '0 20px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(139,92,246,0.14)',
            fontFamily: t.font,
          }}
        >
          {/* Progress dots + close */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {STEPS.map((_, i) => (
                <motion.div key={i}
                  animate={{
                    width: i === step ? 18 : 5,
                    background: i === step ? '#8B5CF6' : i < step ? 'rgba(139,92,246,0.45)' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  }}
                  transition={{ duration: 0.25 }}
                  style={{ height: 5, borderRadius: 3, flexShrink: 0 }}
                />
              ))}
            </div>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.subtext, fontSize: 20, lineHeight: 1, padding: '0 2px' }}
            >×</button>
          </div>

          {/* Dashboard logo + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: 'white',
              boxShadow: '0 3px 12px rgba(139,92,246,0.42)',
            }}>
              ✦
            </div>
            <h3 style={{ margin: 0, color: t.text, fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
              {cur.title}
            </h3>
          </div>

          {/* Description */}
          <p style={{ margin: '0 0 16px', color: t.subtext, fontSize: 13, lineHeight: 1.6 }}>
            {cur.desc}
          </p>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
              style={{ background: 'transparent', border: `1px solid ${isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 8, padding: '6px 13px', fontSize: 12, fontWeight: 600, color: t.subtext, cursor: 'pointer', fontFamily: t.font, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.color = '#8B5CF6'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = t.subtext; }}
            >
              {step === 0 ? 'Skip' : '← Back'}
            </button>
            <span style={{ fontSize: 11, color: t.mutedText }}>{step + 1}/{STEPS.length}</span>
            <button
              onClick={step < STEPS.length - 1 ? () => setStep(s => s + 1) : onClose}
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: t.font, boxShadow: '0 3px 12px rgba(139,92,246,0.44)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 5px 18px rgba(139,92,246,0.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(139,92,246,0.44)'; }}
            >
              {step === STEPS.length - 1 ? 'Get Started' : 'Next →'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default UserGuide;
