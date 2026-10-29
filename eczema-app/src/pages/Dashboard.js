// src/pages/Dashboard.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme, getColors } from '../context/ThemeContext';
import { analyzeImage } from '../services/analysisService';
import { saveAnalysisToHistory } from '../services/storage';
import ImageUpload from '../components/ImageUpload';
import PatientForm from '../components/PatientQuestionnaire';
import AnalysisResults from '../components/AnalysisResults';
import UserGuide from '../components/UserGuide';

const skinQuotes = [
  { quote: "Hydration is the foundation of healthy skin. Drink water and moisturize daily.", author: "Dermatology Insight" },
  { quote: "Healthy skin is a lifelong investment.", author: "SkinSight AI" },
  { quote: "Early detection is the best protection.", author: "Medical Wisdom" },
  { quote: "Every skin tells a unique story.", author: "SkinSight AI" },
  { quote: "Precision diagnosis, personalized care.", author: "SkinSight AI" },
  { quote: "AI-powered insights for better skin health.", author: "SkinSight AI" },
];

const NavItem = ({ icon, label, active, onClick, t, id }) => (
  <a
    id={id}
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px',
      borderRadius: 12, cursor: 'pointer', marginBottom: 4,
      background: active ? t.navActive : 'transparent',
      color: active ? t.navActiveText : t.navText,
      fontWeight: 500, fontSize: 15, textDecoration: 'none',
      transition: 'all 0.2s ease',
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.navHover; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
  >
    {icon}{label}
  </a>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { isDark } = useTheme();
  const t = getColors(isDark);

  const [activeStep, setActiveStep] = useState(0);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * skinQuotes.length));
  const [submittedPatientData, setSubmittedPatientData] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('skinsight_guide_seen');
    if (!seen) {
      const timer = setTimeout(() => {
        setShowGuide(true);
        localStorage.setItem('skinsight_guide_seen', 'true');
      }, 900);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setQuoteIndex(prev => (prev + 1) % skinQuotes.length), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (success) { const id = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(id); }
  }, [success]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const handleImageUpload = (image) => {
    setUploadedImage(image);
    if (image) setImagePreviewUrl(URL.createObjectURL(image));
    setActiveStep(1);
    setError('');
    setSuccess('Image uploaded successfully!');
  };

  const handlePatientDataSubmit = async (data) => {
    setLoading(true);
    setSubmittedPatientData(data);
    setError('');
    const result = await analyzeImage(uploadedImage, { ...data, userId: currentUser.uid });
    if (result.success) {
      setAnalysisResults(result.data);
      await saveAnalysisToHistory(currentUser.uid, { ...result.data, patientName: data.name, patientAge: data.age });
      setActiveStep(2);
      setSuccess('Analysis completed successfully!');
    } else {
      setError(result.error || 'Analysis failed. Please try again.');
    }
    setLoading(false);
  };

  const handleReset = () => {
    setActiveStep(0);
    setUploadedImage(null);
    setImagePreviewUrl(null);
    setAnalysisResults(null);
    setError('');
    setSuccess('');
  };

  const navIcons = {
    dashboard: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    history: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    settings: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  };

  const steps = ['Upload Image', 'Patient Info', 'Results'];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: t.pageBg,
      fontFamily: t.font,
      overflow: 'hidden', position: 'relative',
      transition: 'background 0.4s ease',
    }}>
      <style>{`
        @import url('${t.fontImport}');
        @keyframes rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .dash-card {
          background: ${t.card};
          border: 1px solid ${t.cardBdr};
          border-radius: 20px;
          backdrop-filter: blur(12px);
        }
        .feature-card {
          background: ${t.featureCard};
          border: 1px solid ${t.featureBdr};
          border-radius: 16px;
          padding: 32px 20px;
          text-align: center;
          transition: all 0.25s ease;
          cursor: default;
        }
        .feature-card:hover {
          background: ${t.navHover};
          border-color: rgba(139,92,246,0.3);
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(139,92,246,0.12);
        }
        .btn-ghost {
          background: transparent;
          border: 1px solid ${t.inputBdr};
          padding: 9px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: ${t.navText};
          transition: all 0.2s ease;
        }
        .btn-ghost:hover { background: ${t.navHover}; color: ${t.text}; }
        .step-connector {
          flex: 1;
          height: 2px;
          background: rgba(139,92,246,0.15);
          margin: 0 4px;
          margin-bottom: 24px;
          border-radius: 2px;
          transition: background 0.4s ease;
        }
        .step-connector.done { background: linear-gradient(90deg, #8B5CF6, #3B82F6); }
      `}</style>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: t.blob1 }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: 500, height: 500, borderRadius: '50%', background: t.blob2 }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: isDark ? 0.025 : 0.035 }}>
          <defs><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke={isDark ? 'white' : '#667eea'} strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* SIDEBAR */}
      <motion.aside
        id="guide-sidebar"
        initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        style={{
          width: 230, height: '100vh',
          background: t.sidebar, borderRight: `1px solid ${t.sidebarBdr}`,
          display: 'flex', flexDirection: 'column',
          padding: '28px 14px',
          position: 'fixed', left: 0, top: 0, zIndex: 10,
          backdropFilter: 'blur(16px)', transition: 'background 0.4s ease',
          overflowY: 'auto',
        }}
      >
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
          <NavItem t={t} active icon={navIcons.dashboard} label="Dashboard" onClick={() => navigate('/dashboard')} />
          <NavItem t={t} icon={navIcons.history}  label="History"   onClick={() => navigate('/history')}  id="guide-nav-history" />
          <NavItem t={t} icon={navIcons.settings} label="Settings"  onClick={() => navigate('/settings')} id="guide-nav-settings" />
        </nav>
        <div style={{ background: t.infoBg, border: `1px solid ${t.infoBdr}`, borderRadius: 16, padding: '18px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>AI-Powered Analysis</div>
          <div style={{ fontSize: 12.5, color: t.subtext, lineHeight: 1.65 }}>Advanced skin detection using state-of-the-art machine learning</div>
        </div>
      </motion.aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', position: 'relative', zIndex: 1, minWidth: 0, marginLeft: 230 }}>

        {/* Header */}
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
            <h1 style={{ margin: 0, fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>
              Welcome back,{' '}
              <span style={{ background: 'linear-gradient(90deg, #8B5CF6, #3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {currentUser?.displayName || 'Doctor'}
              </span>
            </h1>
            <p style={{ margin: '5px 0 0', color: t.subtext, fontSize: 13.5 }}>
              AI-powered skin analysis and personalized skincare recommendations
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Guide button */}
            <button
              id="guide-help-btn"
              onClick={() => setShowGuide(true)}
              title="User Guide"
              style={{
                height: 38, paddingLeft: 13, paddingRight: 16,
                borderRadius: 19, border: `1px solid ${isDark ? 'rgba(139,92,246,0.38)' : 'rgba(139,92,246,0.28)'}`,
                background: isDark ? 'rgba(139,92,246,0.13)' : 'rgba(139,92,246,0.08)',
                display: 'flex', alignItems: 'center', gap: 7,
                cursor: 'pointer',
                color: isDark ? 'rgba(200,180,255,0.88)' : '#7C3AED',
                fontSize: 13, fontWeight: 600, fontFamily: t.font,
                transition: 'all 0.22s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.28), rgba(59,130,246,0.28))';
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)';
                e.currentTarget.style.color = isDark ? 'rgba(220,200,255,1)' : '#6D28D9';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(139,92,246,0.22)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isDark ? 'rgba(139,92,246,0.13)' : 'rgba(139,92,246,0.08)';
                e.currentTarget.style.borderColor = isDark ? 'rgba(139,92,246,0.38)' : 'rgba(139,92,246,0.28)';
                e.currentTarget.style.color = isDark ? 'rgba(200,180,255,0.88)' : '#7C3AED';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3"/>
              </svg>
              Guide
            </button>
            {/* Logout button */}
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

        {/* Toast */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
              style={{ position: 'fixed', top: 84, right: 28, zIndex: 200, background: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.1)', border: `1px solid ${t.successBdr}`, borderRadius: 14, padding: '13px 18px', color: '#10B981', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(16px)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', maxWidth: 300, fontFamily: t.font }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {success}
              <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: 18, marginLeft: 4, padding: 0, lineHeight: 1 }}>×</button>
            </motion.div>
          )}
        </AnimatePresence>

        <main style={{ flex: 1, padding: '36px 40px' }}>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ background: t.errorBg, border: `1px solid ${t.errorBdr}`, borderRadius: 12, padding: '13px 18px', marginBottom: 24, color: '#FCA5A5', fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>⚠ {error}</span>
                <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontSize: 20 }}>×</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stepper */}
          <div id="guide-stepper" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
            {steps.map((label, index) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', flex: index < steps.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: index <= activeStep ? 'linear-gradient(135deg, #8B5CF6, #3B82F6)' : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                    border: index === activeStep ? '2.5px solid rgba(139,92,246,0.5)' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700,
                    color: index <= activeStep ? 'white' : t.mutedText,
                    boxShadow: index === activeStep ? '0 0 22px rgba(139,92,246,0.4)' : 'none',
                    transition: 'all 0.35s ease',
                  }}>
                    {index < activeStep
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : index + 1}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: index === activeStep ? '#8B5CF6' : t.mutedText, transition: 'color 0.3s ease' }}>{label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`step-connector${index < activeStep ? ' done' : ''}`} />
                )}
              </div>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '90px 0' }}>
              <div style={{ position: 'relative', width: 84, height: 84, margin: '0 auto 28px' }}>
                <div style={{ width: 84, height: 84, borderRadius: '50%', border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8B5CF6', animation: 'rotate-slow 1s linear infinite', position: 'absolute' }} />
                <div style={{ width: 62, height: 62, borderRadius: '50%', border: '3px solid rgba(59,130,246,0.2)', borderBottomColor: '#3B82F6', animation: 'rotate-slow 1.5s linear infinite reverse', position: 'absolute', top: 11, left: 11 }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🔬</div>
              </div>
              <h3 style={{ color: t.text, fontFamily: 'Syne, sans-serif', fontSize: 22, margin: '0 0 10px' }}>Analyzing with AI...</h3>
              <p style={{ color: t.subtext, fontSize: 14, margin: 0 }}>This may take 30–60 seconds</p>
            </motion.div>
          )}

          {!loading && (
            <AnimatePresence mode="wait">

              {/* STEP 0 */}
              {activeStep === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

                  {/* Tip banner */}
                  <div className="dash-card" style={{ padding: '36px 44px', marginBottom: 32, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #8B5CF6, #3B82F6, #8B5CF6)', backgroundSize: '200% 100%' }} />
                    <div style={{ fontSize: 12, color: '#8B5CF6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 18 }}>Daily Skincare Tip</div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 18px rgba(139,92,246,0.4)', flexShrink: 0 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </div>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div key={quoteIndex} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
                        <div style={{ fontSize: 18, color: t.text, lineHeight: 1.7, fontWeight: 500, maxWidth: 640, margin: '0 auto', fontStyle: 'italic' }}>
                          {skinQuotes[quoteIndex].quote}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Upload card */}
                  <div id="guide-upload-card" className="dash-card" style={{ padding: '44px 52px', marginBottom: 28 }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                      <h2 style={{ color: t.text, fontFamily: 'Syne, sans-serif', fontSize: 26, margin: '0 0 10px', fontWeight: 700 }}>Upload Skin Image</h2>
                      <p style={{ color: t.subtext, fontSize: 15, margin: 0, lineHeight: 1.6 }}>Upload a clear photo of the affected area for AI analysis</p>
                    </div>
                    <ImageUpload onImageSelect={handleImageUpload} />
                    <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 24 }}>
                      {['JPG', 'PNG', 'Max 10MB'].map(tag => (
                        <span key={tag} style={{ fontSize: 13, color: t.mutedText, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', display: 'inline-block' }} />{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* CTA card */}
                  <div className="dash-card" style={{ padding: '52px 48px', marginBottom: 28, textAlign: 'center', background: isDark ? 'linear-gradient(135deg, rgba(139,92,246,0.13), rgba(59,130,246,0.13))' : 'linear-gradient(135deg, rgba(103,126,234,0.09), rgba(118,75,162,0.09))' }}>
                    <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 12px 36px rgba(139,92,246,0.45)' }}>
                      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                    </div>
                    <h3 style={{ color: t.text, fontFamily: 'Syne, sans-serif', fontSize: 24, margin: '0 0 14px', fontWeight: 700 }}>Start Your First Analysis</h3>
                    <p style={{ color: t.subtext, fontSize: 15, lineHeight: 1.75, margin: '0 auto', maxWidth: 540 }}>Upload a clear photo of the skin area you'd like to analyze, and our AI will provide detailed insights and recommendations.</p>
                  </div>

                  {/* Feature cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
                    {[
                      { icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>, title: 'Upload Image', desc: 'Take or upload a clear photo' },
                      { icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, title: 'AI Analysis', desc: 'Get instant AI-powered insights' },
                      { icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, title: 'Get Results', desc: 'Receive detailed recommendations' },
                    ].map(item => (
                      <div key={item.title} className="feature-card">
                        <div style={{ width: 68, height: 68, borderRadius: '50%', background: t.badgeBg, border: `1px solid ${t.badgeBdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>{item.icon}</div>
                        <div style={{ color: t.text, fontWeight: 700, fontSize: 16, marginBottom: 8, fontFamily: 'Syne, sans-serif' }}>{item.title}</div>
                        <div style={{ color: t.subtext, fontSize: 13.5, lineHeight: 1.5 }}>{item.desc}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* STEP 1 */}
              {activeStep === 1 && uploadedImage && (
                <motion.div key="step1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
                  <div style={{ maxWidth: 760, margin: '0 auto' }}>
                    {imagePreviewUrl && (
                      <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <img src={imagePreviewUrl} alt="Uploaded skin" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 18, boxShadow: isDark ? '0 10px 48px rgba(0,0,0,0.55)' : '0 10px 48px rgba(103,126,234,0.22)', display: 'block', margin: '0 auto', objectFit: 'contain' }} />
                      </div>
                    )}
                    <PatientForm onSubmit={handlePatientDataSubmit} onBack={() => { setActiveStep(0); setImagePreviewUrl(null); }} />
                  </div>
                </motion.div>
              )}

              {/* STEP 2 */}
              {activeStep === 2 && analysisResults && (
                <motion.div key="step2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
                  <AnalysisResults results={analysisResults} patientData={submittedPatientData} onReset={handleReset} />
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </main>

        <footer style={{ padding: '20px 40px', borderTop: `1px solid ${t.headerBdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.headerBg, backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✦</div>
            <span style={{ fontSize: 12, color: t.subtext, fontWeight: 500 }}>SkinSight — Made with ❤ by the SkinSight Team</span>
          </div>
          <div style={{ display: 'flex', gap: 22 }}>
            {['Privacy Policy', 'Terms of Service', 'Contact'].map(link => (
              <a key={link} style={{ fontSize: 12, color: t.subtext, textDecoration: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#8B5CF6'; }}
                onMouseLeave={e => { e.currentTarget.style.color = t.subtext; }}
              >{link}</a>
            ))}
          </div>
          <span style={{ fontSize: 12, color: t.subtext }}>© 2026 SkinSight AI. All rights reserved.</span>
        </footer>
      </div>

      {/* User Guide overlay */}
      <UserGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        isDark={isDark}
        t={t}
      />
    </div>
  );
};

export default Dashboard;