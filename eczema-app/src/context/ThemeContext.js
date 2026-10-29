// src/context/ThemeContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({});
export const useTheme = () => useContext(ThemeContext);

/** Call this in every page to get all colour tokens for the current mode. */
export const getColors = (isDark) => ({
  // ── layout ────────────────────────────────────────────────────
  pageBg:     isDark ? '#0A0A1A'                          : 'linear-gradient(135deg, #eef2ff 0%, #f3eeff 100%)',
  sidebar:    isDark ? 'rgba(255,255,255,0.03)'           : 'rgba(255,255,255,0.72)',
  sidebarBdr: isDark ? 'rgba(255,255,255,0.06)'           : 'rgba(103,126,234,0.18)',
  headerBg:   isDark ? 'rgba(255,255,255,0.02)'           : 'rgba(255,255,255,0.65)',
  headerBdr:  isDark ? 'rgba(255,255,255,0.05)'           : 'rgba(103,126,234,0.12)',
  // ── cards ─────────────────────────────────────────────────────
  card:       isDark ? 'rgba(255,255,255,0.04)'           : 'rgba(255,255,255,0.88)',
  cardBdr:    isDark ? 'rgba(255,255,255,0.08)'           : 'rgba(103,126,234,0.18)',
  featureCard:isDark ? 'rgba(255,255,255,0.03)'           : 'rgba(255,255,255,0.7)',
  featureBdr: isDark ? 'rgba(255,255,255,0.06)'           : 'rgba(103,126,234,0.14)',
  // ── text ──────────────────────────────────────────────────────
  text:       isDark ? '#ffffff'                          : '#2d3170',
  subtext:    isDark ? 'rgba(255,255,255,0.4)'            : 'rgba(45,49,112,0.55)',
  mutedText:  isDark ? 'rgba(255,255,255,0.25)'           : 'rgba(45,49,112,0.35)',
  // ── nav ───────────────────────────────────────────────────────
  navText:    isDark ? 'rgba(255,255,255,0.5)'            : 'rgba(45,49,112,0.55)',
  navHover:   isDark ? 'rgba(139,92,246,0.15)'            : 'rgba(103,126,234,0.12)',
  navActive:  isDark
    ? 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(59,130,246,0.3))'
    : 'linear-gradient(135deg, rgba(103,126,234,0.2), rgba(118,75,162,0.2))',
  navActiveText: isDark ? 'white'                         : '#5B21B6',
  // ── inputs ────────────────────────────────────────────────────
  inputBg:    isDark ? 'rgba(255,255,255,0.05)'           : 'rgba(103,126,234,0.06)',
  inputBdr:   isDark ? 'rgba(255,255,255,0.1)'            : 'rgba(103,126,234,0.22)',
  // ── dividers ──────────────────────────────────────────────────
  divider:    isDark ? 'rgba(255,255,255,0.05)'           : 'rgba(103,126,234,0.1)',
  rowBdr:     isDark ? 'rgba(255,255,255,0.05)'           : 'rgba(103,126,234,0.1)',
  // ── blobs & decorations ───────────────────────────────────────
  blob1:      isDark
    ? 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)'
    : 'radial-gradient(circle, rgba(103,126,234,0.18) 0%, transparent 70%)',
  blob2:      isDark
    ? 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)'
    : 'radial-gradient(circle, rgba(118,75,162,0.14) 0%, transparent 70%)',
  particle:   isDark ? 'rgba(139,92,246,0.15)'            : 'rgba(103,126,234,0.12)',
  // ── badges / tip chip ─────────────────────────────────────────
  badgeBg:    isDark ? 'rgba(139,92,246,0.1)'             : 'rgba(103,126,234,0.1)',
  badgeBdr:   isDark ? 'rgba(139,92,246,0.2)'             : 'rgba(103,126,234,0.22)',
  // ── sidebar info card ─────────────────────────────────────────
  infoBg:     isDark
    ? 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))'
    : 'linear-gradient(135deg, rgba(103,126,234,0.14), rgba(118,75,162,0.14))',
  infoBdr:    isDark ? 'rgba(139,92,246,0.2)'             : 'rgba(103,126,234,0.25)',
  // ── step indicator (inactive) ─────────────────────────────────
  stepInactive: isDark ? 'rgba(255,255,255,0.08)'         : 'rgba(103,126,234,0.12)',
  // ── alerts ────────────────────────────────────────────────────
  errorBg:    isDark ? 'rgba(239,68,68,0.1)'              : 'rgba(239,68,68,0.07)',
  errorBdr:   isDark ? 'rgba(239,68,68,0.3)'              : 'rgba(239,68,68,0.25)',
  successBg:  isDark ? 'rgba(16,185,129,0.1)'             : 'rgba(16,185,129,0.07)',
  successBdr: isDark ? 'rgba(16,185,129,0.3)'             : 'rgba(16,185,129,0.25)',
  // ── record card (history) ─────────────────────────────────────
  recordCard: isDark ? 'rgba(255,255,255,0.03)'           : 'rgba(255,255,255,0.82)',
  recordBdr:  isDark ? 'rgba(255,255,255,0.07)'           : 'rgba(103,126,234,0.15)',
  // ── danger zone ───────────────────────────────────────────────
  dangerCard: isDark ? 'rgba(239,68,68,0.06)'             : 'rgba(239,68,68,0.04)',
  dangerBdr:  isDark ? 'rgba(239,68,68,0.2)'              : 'rgba(239,68,68,0.18)',
  // ── font ──────────────────────────────────────────────────────
  font: '"Plus Jakarta Sans", "Inter", sans-serif',
  fontImport: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,opsz,wght@0,6..18,300;0,6..18,400;0,6..18,500;0,6..18,600;0,6..18,700;0,6..18,800&family=Syne:wght@600;700;800&display=swap',
});

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('skinsight_theme');
    return saved !== null ? saved === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('skinsight_theme', isDark ? 'dark' : 'light');
    const colors = getColors(isDark);
    // Apply to body so areas outside page containers also update
    document.body.style.background = isDark ? '#0A0A1A' : 'linear-gradient(135deg, #eef2ff 0%, #f3eeff 100%)';
    document.body.style.color = isDark ? 'white' : colors.text;
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
