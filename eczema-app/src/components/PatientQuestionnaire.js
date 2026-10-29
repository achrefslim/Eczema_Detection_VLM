// src/components/PatientQuestionnaire.js
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, getColors } from '../context/ThemeContext';

const questions = [
  {
    id: 'name',
    question: "What's the patient's name?",
    placeholder: "Enter patient's full name",
    type: 'text',
  },
  {
    id: 'age',
    question: "How old is the patient?",
    placeholder: "Enter patient's age",
    type: 'number',
    unit: { field: 'ageUnit', options: ['years', 'months'], default: 'years' },
  },
  {
    id: 'duration',
    question: 'When did the skin issue start?',
    placeholder: 'e.g., 2',
    type: 'number',
    unit: { field: 'durationUnit', options: ['days', 'weeks', 'months', 'years'], default: 'weeks' },
  },
  {
    id: 'description',
    question: 'Describe the issue',
    placeholder: 'Provide details about symptoms, changes, or concerns...',
    type: 'textarea',
  },
];

const PatientQuestionnaire = ({ onSubmit, onBack }) => {
  const { isDark } = useTheme();
  const t = getColors(isDark);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', age: '', ageUnit: 'years',
    duration: '', durationUnit: 'weeks',
    description: '',
  });
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const q = questions[step];
  const pct = Math.round(((step + 1) / questions.length) * 100);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [step]);

  const validate = () => {
    const val = form[q.id];
    if (!val?.toString().trim()) { setError('This field is required'); return false; }
    if (q.id === 'age') {
      const n = Number(val);
      if (isNaN(n) || n < 0 || n > 150) { setError('Please enter a valid age (0–150)'); return false; }
    }
    if (q.id === 'duration') {
      const n = Number(val);
      if (isNaN(n) || n < 0) { setError('Please enter a valid number'); return false; }
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;
    if (step < questions.length - 1) {
      setStep(s => s + 1);
      setError('');
    } else {
      onSubmit({
        name: form.name,
        age: Number(form.age),
        ageUnit: form.ageUnit,
        duration: `${form.duration} ${form.durationUnit}`,
        description: form.description,
      });
    }
  };

  const handleBack = () => {
    if (step > 0) { setStep(s => s - 1); setError(''); }
    else onBack();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && q.type !== 'textarea') handleNext();
  };

  const setField = (val) => {
    setForm(f => ({ ...f, [q.id]: val }));
    if (error) setError('');
  };

  const setUnit = (field, val) => setForm(f => ({ ...f, [field]: val }));

  // ── Styles ────────────────────────────────────────────────────────────
  const inputStyle = {
    flex: 1,
    background: t.inputBg,
    border: `1.5px solid ${error ? 'rgba(239,68,68,0.55)' : t.inputBdr}`,
    borderRadius: 12,
    padding: '15px 18px',
    fontSize: 15.5,
    color: t.text,
    fontFamily: t.font,
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box',
  };

  const selectStyle = {
    background: isDark ? '#1e1b3a' : '#ffffff',
    border: `1.5px solid ${t.inputBdr}`,
    borderRadius: 12,
    padding: '15px 14px',
    fontSize: 14,
    color: t.text,
    fontFamily: t.font,
    outline: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    colorScheme: isDark ? 'dark' : 'light',
  };

  return (
    <div style={{
      background: t.card,
      border: `1px solid ${t.cardBdr}`,
      borderRadius: 20,
      padding: '36px 44px',
      fontFamily: t.font,
      backdropFilter: 'blur(12px)',
    }}>

      {/* Progress header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: t.subtext, fontWeight: 600 }}>
          Step {step + 1} of {questions.length}
        </span>
        <span style={{ fontSize: 13, color: '#8B5CF6', fontWeight: 700 }}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 6, background: t.stepInactive, borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          style={{ height: '100%', background: 'linear-gradient(90deg, #8B5CF6, #3B82F6)', borderRadius: 10 }}
        />
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 36 }}>
        {questions.map((_, i) => (
          <motion.div
            key={i}
            animate={{ width: i === step ? 28 : 8 }}
            transition={{ duration: 0.3 }}
            style={{
              height: 8, borderRadius: 4,
              background: i <= step
                ? 'linear-gradient(90deg, #8B5CF6, #3B82F6)'
                : t.stepInactive,
            }}
          />
        ))}
      </div>

      {/* Question + Input */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -28 }}
          transition={{ duration: 0.22 }}
        >
          <h2 style={{
            color: t.text, fontSize: 25, fontWeight: 700,
            margin: '0 0 28px', display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'Syne, sans-serif',
          }}>
            <span style={{ color: '#8B5CF6', fontSize: 20 }}>✦</span>
            {q.question}
          </h2>

          {/* Input row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: error ? 10 : 32 }}>
            {q.type === 'textarea' ? (
              <textarea
                ref={inputRef}
                value={form[q.id]}
                onChange={e => setField(e.target.value)}
                placeholder={q.placeholder}
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }}
              />
            ) : (
              <>
                <input
                  ref={inputRef}
                  type={q.type}
                  value={form[q.id]}
                  onChange={e => setField(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={q.placeholder}
                  min={q.id === 'age' || q.id === 'duration' ? 0 : undefined}
                  style={inputStyle}
                />
                {q.unit && (
                  <select
                    value={form[q.unit.field]}
                    onChange={e => setUnit(q.unit.field, e.target.value)}
                    style={selectStyle}
                  >
                    {q.unit.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ color: 'rgba(239,68,68,0.9)', fontSize: 13, marginBottom: 24, paddingLeft: 2 }}>
              ⚠ {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleBack}
              style={{
                background: 'transparent',
                border: `1.5px solid ${t.inputBdr}`,
                borderRadius: 12, padding: '13px 22px',
                fontSize: 14, fontWeight: 600,
                color: t.navText, cursor: 'pointer',
                fontFamily: t.font,
                display: 'flex', alignItems: 'center', gap: 7,
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = t.navHover; e.currentTarget.style.color = t.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.navText; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back
            </button>

            <button
              onClick={handleNext}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)',
                border: 'none', borderRadius: 12,
                padding: '13px',
                fontSize: 15, fontWeight: 700,
                color: 'white', cursor: 'pointer',
                fontFamily: t.font,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(139,92,246,0.35)',
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {step === questions.length - 1 ? (
                <>
                  <span>✦</span> Analyze Now
                </>
              ) : (
                <>
                  Next
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Enter hint */}
          {q.type !== 'textarea' && (
            <div style={{ textAlign: 'center', marginTop: 14, color: t.mutedText, fontSize: 12.5 }}>
              Press Enter to continue
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PatientQuestionnaire;
