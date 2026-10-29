// src/pages/Settings.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme, getColors } from '../context/ThemeContext';
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// ─────────────────────────────────────────────────────────────────────────────
// All sub-components are defined at MODULE LEVEL so React never unmounts them
// on re-render (avoids focus-loss and loading-state reset bugs).
// ─────────────────────────────────────────────────────────────────────────────

const Toggle = ({ checked, onChange }) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      width: 46, height: 26, borderRadius: 13,
      background: checked ? 'linear-gradient(135deg, #8B5CF6, #3B82F6)' : 'rgba(128,128,128,0.25)',
      position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease',
      boxShadow: checked ? '0 0 12px rgba(139,92,246,0.4)' : 'none',
      flexShrink: 0,
    }}
  >
    <div style={{
      position: 'absolute', top: 3,
      left: checked ? 23 : 3,
      width: 20, height: 20, borderRadius: '50%',
      background: 'white', transition: 'left 0.3s ease',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    }} />
  </div>
);

const Toast = ({ msg, type }) => {
  const colors = {
    success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#6EE7B7', icon: '✓' },
    error:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#FCA5A5', icon: '✕' },
  };
  const c = colors[type] || colors.success;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 10, padding: '10px 14px',
        color: c.text, fontSize: 13, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span style={{ fontWeight: 700 }}>{c.icon}</span> {msg}
    </motion.div>
  );
};

const SectionCard = ({ icon, title, children, t }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    style={{
      background: t.card, border: `1px solid ${t.cardBdr}`,
      borderRadius: 20, padding: '28px', marginBottom: 20,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.2))',
        border: '1px solid rgba(139,92,246,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>{icon}</div>
      <h3 style={{ margin: 0, color: t.text, fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700 }}>{title}</h3>
    </div>
    {children}
  </motion.div>
);

const FieldInput = ({ value, onChange, placeholder, type, readOnly, rightSlot, t }) => (
  <div style={{ position: 'relative' }}>
    <input
      type={type || 'text'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: readOnly ? 'transparent' : t.inputBg,
        border: `1px solid ${t.inputBdr}`,
        borderRadius: 12,
        padding: rightSlot ? '12px 44px 12px 16px' : '12px 16px',
        color: readOnly ? t.subtext : t.text,
        fontSize: 14, fontFamily: 'inherit', outline: 'none',
        transition: 'border-color 0.2s',
        cursor: readOnly ? 'default' : 'text',
      }}
      onFocus={e => { if (!readOnly) e.target.style.borderColor = 'rgba(139,92,246,0.6)'; }}
      onBlur={e => { e.target.style.borderColor = t.inputBdr; }}
    />
    {rightSlot && (
      <button
        type="button"
        onClick={rightSlot.onClick}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: t.subtext, fontSize: 16, padding: 0,
          display: 'flex', alignItems: 'center',
        }}
      >{rightSlot.icon}</button>
    )}
  </div>
);

const SettingRow = ({ label, desc, checked, onChange, t, noBorder }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 0',
    borderBottom: noBorder ? 'none' : `1px solid ${t.rowBdr}`,
  }}>
    <div>
      <div style={{ color: t.text, fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ color: t.subtext, fontSize: 12 }}>{desc}</div>
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const Spinner = () => (
  <>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const Settings = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const t = getColors(isDark);

  // ── profile ──────────────────────────────────────────────────
  const [profile, setProfile] = useState({ name: '', email: '', license: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  // ── password ─────────────────────────────────────────────────
  const [passwords, setPasswords] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);

  // ── preferences ──────────────────────────────────────────────
  const load = (key, def) => {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; }
    catch { return def; }
  };
  const [notifications, setNotifications] = useState(() => load('skinsight_notif',     { analysisAlerts: true, emailReports: true, weeklySummary: false }));
  const [privacy,        setPrivacy]        = useState(() => load('skinsight_privacy',   { twoFactor: false, dataEncryption: true, autoDelete: false }));
  const [appearance,     setAppearance]     = useState(() => load('skinsight_appearance',{ animations: true, compactMode: false }));

  // ── delete modal ─────────────────────────────────────────────
  const [deleteModal,    setDeleteModal]    = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading,  setDeleteLoading]  = useState(false);
  const [deleteMsg,      setDeleteMsg]      = useState(null);

  useEffect(() => {
    if (currentUser) {
      setProfile({ name: currentUser.displayName || '', email: currentUser.email || '', license: '' });
    }
  }, [currentUser]);

  useEffect(() => { localStorage.setItem('skinsight_notif',      JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('skinsight_privacy',    JSON.stringify(privacy));        }, [privacy]);
  useEffect(() => { localStorage.setItem('skinsight_appearance', JSON.stringify(appearance));     }, [appearance]);

  // ── helpers ───────────────────────────────────────────────────
  const flash = (setter, msg, type = 'success', ms = 3500) => {
    setter({ msg, type });
    setTimeout(() => setter(null), ms);
  };

  // ── handlers ─────────────────────────────────────────────────
  const handleProfileSave = async () => {
    if (!profile.name.trim()) { flash(setProfileMsg, 'Name cannot be empty', 'error'); return; }
    setProfileLoading(true);
    try {
      await updateProfile(auth.currentUser, { displayName: profile.name.trim() });
      await setDoc(doc(db, 'users', currentUser.uid), { fullName: profile.name.trim() }, { merge: true });
      flash(setProfileMsg, 'Profile updated successfully!');
    } catch (err) {
      flash(setProfileMsg, err.message, 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    const { current, newPw, confirm } = passwords;
    if (!current || !newPw || !confirm) { flash(setPasswordMsg, 'All fields are required', 'error'); return; }
    if (newPw !== confirm)              { flash(setPasswordMsg, 'New passwords do not match', 'error'); return; }
    if (newPw.length < 6)              { flash(setPasswordMsg, 'Password must be at least 6 characters', 'error'); return; }
    if (newPw === current)             { flash(setPasswordMsg, 'New password must differ from current', 'error'); return; }
    setPasswordLoading(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, current);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPw);
      setPasswords({ current: '', newPw: '', confirm: '' });
      flash(setPasswordMsg, 'Password changed successfully!');
    } catch (err) {
      const msg = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Current password is incorrect'
        : err.message;
      flash(setPasswordMsg, msg, 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) { flash(setDeleteMsg, 'Please enter your password to confirm', 'error'); return; }
    setDeleteLoading(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await deleteUser(auth.currentUser);
      navigate('/login');
    } catch (err) {
      const msg = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Incorrect password' : err.message;
      flash(setDeleteMsg, msg, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const primaryBtn = (loading, label, loadLabel, onClick) => (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        background: loading ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #8B5CF6, #3B82F6)',
        color: 'white', border: 'none', padding: '11px 28px',
        borderRadius: 12, fontSize: 14, fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', transition: 'all 0.3s ease',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
    >
      {loading ? <><Spinner />{loadLabel}</> : label}
    </button>
  );

  // ── render ────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: t.pageBg, fontFamily: t.font,
      position: 'relative', transition: 'background 0.4s ease',
    }}>
      <style>{`
        @import url('${t.fontImport}');
        .modal-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
        }
      `}</style>

      {isDark && (
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />
        </div>
      )}

      {/* Sidebar */}
      <aside style={{
        width: 230,
        background: t.sidebar, borderRight: `1px solid ${t.sidebarBdr}`,
        display: 'flex', flexDirection: 'column',
        padding: '28px 14px', position: 'fixed', left: 0, top: 0, height: '100vh',
        zIndex: 10, overflowY: 'auto',
        backdropFilter: 'blur(16px)', transition: 'background 0.4s ease',
      }}>
        <div style={{ padding: '0 8px', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: '0 4px 15px rgba(139,92,246,0.4)' }}>✦</div>
            <div>
              <div style={{ color: t.text, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>SkinSight</div>
              <div style={{ color: 'rgba(139,92,246,0.8)', fontSize: 10, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>Analysis Pro</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {[
            { label: 'Dashboard', path: '/dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
            { label: 'History',   path: '/history',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
            { label: 'Settings',  path: '/settings',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
          ].map(({ label, path, icon }) => {
            const active = window.location.pathname === path;
            return (
              <a key={path} onClick={() => navigate(path)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderRadius: 12, cursor: 'pointer', marginBottom: 4,
                background: active ? t.navActive : 'transparent',
                color: active ? t.navActiveText : t.navText,
                fontWeight: 500, fontSize: 14, textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                {icon}{label}
              </a>
            );
          })}
        </nav>

        <div style={{ background: t.infoBg, border: `1px solid ${t.infoBdr}`, borderRadius: 16, padding: '18px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>AI-Powered Analysis</div>
          <div style={{ fontSize: 12.5, color: t.subtext, lineHeight: 1.65 }}>Advanced skin detection using state-of-the-art machine learning</div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', zIndex: 1, marginLeft: 230 }}>
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
            <h1 style={{ margin: 0, fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>Settings</h1>
            <p style={{ margin: '5px 0 0', color: t.subtext, fontSize: 13.5 }}>Manage your account preferences and application settings</p>
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
        <div style={{ padding: '40px', maxWidth: 820 }}>

          {/* ── Profile ── */}
          <SectionCard icon="👤" title="Profile Settings" t={t}>
            <AnimatePresence>{profileMsg && <Toast msg={profileMsg.msg} type={profileMsg.type} />}</AnimatePresence>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: t.subtext, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Full Name</label>
                <FieldInput t={t} value={profile.name} placeholder="Enter your full name"
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', color: t.subtext, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                  Email Address <span style={{ fontSize: 11, color: 'rgba(139,92,246,0.7)', marginLeft: 6 }}>● read-only</span>
                </label>
                <FieldInput t={t} value={profile.email} readOnly />
              </div>
              <div>
                <label style={{ display: 'block', color: t.subtext, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Medical License (Optional)</label>
                <FieldInput t={t} value={profile.license} placeholder="Enter license number"
                  onChange={e => setProfile(p => ({ ...p, license: e.target.value }))} />
              </div>
              <div>{primaryBtn(profileLoading, 'Save Changes', 'Saving…', handleProfileSave)}</div>
            </div>
          </SectionCard>

          {/* ── Change Password ── */}
          <SectionCard icon="🔑" title="Change Password" t={t}>
            <AnimatePresence>{passwordMsg && <Toast msg={passwordMsg.msg} type={passwordMsg.type} />}</AnimatePresence>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { key: 'current', label: 'Current Password',      placeholder: 'Enter current password' },
                { key: 'newPw',   label: 'New Password',          placeholder: 'Min. 6 characters' },
                { key: 'confirm', label: 'Confirm New Password',  placeholder: 'Repeat new password' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', color: t.subtext, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{label}</label>
                  <FieldInput
                    t={t}
                    value={passwords[key]}
                    placeholder={placeholder}
                    type={showPw[key] ? 'text' : 'password'}
                    onChange={e => setPasswords(p => ({ ...p, [key]: e.target.value }))}
                    rightSlot={{
                      icon: showPw[key]
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
                      onClick: () => setShowPw(p => ({ ...p, [key]: !p[key] })),
                    }}
                  />
                </div>
              ))}
              <div>{primaryBtn(passwordLoading, 'Update Password', 'Updating…', handlePasswordChange)}</div>
            </div>
          </SectionCard>

          {/* ── Notifications ── */}
          <SectionCard icon="🔔" title="Notifications" t={t}>
            <SettingRow t={t} label="Analysis Complete Alerts" desc="Get notified when analysis is ready"
              checked={notifications.analysisAlerts} onChange={v => setNotifications(n => ({ ...n, analysisAlerts: v }))} />
            <SettingRow t={t} label="Email Reports" desc="Receive analysis reports via email"
              checked={notifications.emailReports} onChange={v => setNotifications(n => ({ ...n, emailReports: v }))} />
            <SettingRow t={t} noBorder label="Weekly Summary" desc="Get weekly analysis statistics"
              checked={notifications.weeklySummary} onChange={v => setNotifications(n => ({ ...n, weeklySummary: v }))} />
          </SectionCard>

          {/* ── Privacy ── */}
          <SectionCard icon="🔒" title="Privacy & Security" t={t}>
            <SettingRow t={t} label="Two-Factor Authentication" desc="Add extra security to your account"
              checked={privacy.twoFactor} onChange={v => setPrivacy(p => ({ ...p, twoFactor: v }))} />
            <SettingRow t={t} label="Data Encryption" desc="Encrypt all stored patient data"
              checked={privacy.dataEncryption} onChange={v => setPrivacy(p => ({ ...p, dataEncryption: v }))} />
            <SettingRow t={t} noBorder label="Auto-delete Old Reports" desc="Remove reports older than 1 year"
              checked={privacy.autoDelete} onChange={v => setPrivacy(p => ({ ...p, autoDelete: v }))} />
          </SectionCard>

          {/* ── Appearance ── */}
          <SectionCard icon="🎨" title="Appearance" t={t}>
            {/* Dark mode uses real ThemeContext */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${t.rowBdr}` }}>
              <div>
                <div style={{ color: t.text, fontSize: 14, fontWeight: 500, marginBottom: 2 }}>Dark Mode</div>
                <div style={{ color: t.subtext, fontSize: 12 }}>{isDark ? 'Currently using dark theme' : 'Currently using light theme'}</div>
              </div>
              <Toggle checked={isDark} onChange={toggleTheme} />
            </div>
            <SettingRow t={t} label="Smooth Animations" desc="Enable transitions and motion effects"
              checked={appearance.animations} onChange={v => setAppearance(a => ({ ...a, animations: v }))} />
            <SettingRow t={t} noBorder label="Compact Mode" desc="Show more content with reduced spacing"
              checked={appearance.compactMode} onChange={v => setAppearance(a => ({ ...a, compactMode: v }))} />
          </SectionCard>

          {/* ── Danger Zone ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: t.dangerCard, border: `1px solid ${t.dangerBdr}`, borderRadius: 20, padding: '28px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚠️</div>
              <h3 style={{ margin: 0, color: '#EF4444', fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700 }}>Danger Zone</h3>
            </div>
            <p style={{ color: t.subtext, fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button onClick={() => setDeleteModal(true)} style={{
              background: 'transparent', color: '#EF4444',
              border: '1px solid rgba(239,68,68,0.4)', padding: '10px 20px',
              borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              Delete My Account
            </button>
          </motion.div>

        </div>

        <footer style={{ padding: '20px 40px', borderTop: `1px solid ${t.headerBdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.headerBg, backdropFilter: 'blur(12px)' }}>
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

      {/* ── Delete Account Modal ── */}
      <AnimatePresence>
        {deleteModal && (
          <div className="modal-overlay" onClick={() => setDeleteModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: isDark ? '#12121F' : 'white',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 20, padding: 32, width: '100%', maxWidth: 420,
                boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
              <h2 style={{ color: '#EF4444', fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, textAlign: 'center', margin: '0 0 8px' }}>Delete Account</h2>
              <p style={{ color: t.subtext, fontSize: 13, textAlign: 'center', margin: '0 0 24px', lineHeight: 1.6 }}>
                This will permanently delete your account and all data. Enter your password to confirm.
              </p>

              <AnimatePresence>{deleteMsg && <Toast msg={deleteMsg.msg} type={deleteMsg.type} />}</AnimatePresence>

              <label style={{ display: 'block', color: t.subtext, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Your Password</label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Enter password to confirm"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: t.inputBg, border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 12, padding: '12px 16px',
                  color: t.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 20,
                }}
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setDeleteModal(false); setDeletePassword(''); setDeleteMsg(null); }}
                  style={{ flex: 1, background: 'transparent', color: t.subtext, border: `1px solid ${t.inputBdr}`, padding: 11, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button onClick={handleDeleteAccount} disabled={deleteLoading}
                  style={{
                    flex: 1, background: deleteLoading ? 'rgba(239,68,68,0.4)' : '#EF4444',
                    color: 'white', border: 'none', padding: 11,
                    borderRadius: 12, fontSize: 14, fontWeight: 600,
                    cursor: deleteLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {deleteLoading ? <><Spinner />Deleting…</> : 'Delete Forever'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Settings;
