// src/components/ImageUpload.js
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme, getColors } from '../context/ThemeContext';

const ImageUpload = ({ onImageSelect }) => {
  const { isDark } = useTheme();
  const t = getColors(isDark);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) { alert('Please upload an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File size must be less than 10MB'); return; }
    onImageSelect(file);
  };

  return (
    <div>
      <motion.div
        animate={isDragging ? { scale: 1.02 } : isHovered ? { scale: 1.005 } : { scale: 1 }}
        transition={{ duration: 0.2 }}
        style={{
          border: `2px dashed ${isDragging || isHovered ? '#8B5CF6' : t.inputBdr}`,
          borderRadius: 16,
          padding: '48px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease',
          background: isDragging
            ? (isDark ? 'rgba(139,92,246,0.1)' : 'rgba(103,126,234,0.09)')
            : isHovered
              ? (isDark ? 'rgba(139,92,246,0.06)' : 'rgba(103,126,234,0.05)')
              : 'transparent',
          boxShadow: isHovered || isDragging
            ? `0 0 0 4px ${isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)'}, 0 12px 40px ${isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)'}`
            : 'none',
          position: 'relative', overflow: 'hidden',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Icon circle */}
        <motion.div
          animate={isHovered || isDragging ? { scale: 1.12, boxShadow: '0 12px 36px rgba(139,92,246,0.55)' } : { scale: 1, boxShadow: '0 8px 24px rgba(139,92,246,0.3)' }}
          transition={{ duration: 0.25 }}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: isHovered || isDragging
              ? 'linear-gradient(135deg, #8B5CF6, #3B82F6)'
              : 'linear-gradient(135deg, rgba(139,92,246,0.75), rgba(59,130,246,0.75))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </motion.div>

        <div style={{ color: isHovered || isDragging ? '#8B5CF6' : t.text, fontSize: 17, fontWeight: 600, marginBottom: 8, fontFamily: t.font, transition: 'color 0.25s ease' }}>
          Drag &amp; drop your image here
        </div>
        <div style={{ color: t.subtext, fontSize: 14, marginBottom: 28, fontFamily: t.font }}>
          or click the buttons below
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{
              background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)',
              border: 'none', borderRadius: 10,
              padding: '10px 22px', fontSize: 14, fontWeight: 600,
              color: 'white', cursor: 'pointer', fontFamily: t.font,
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Choose File
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
            style={{
              background: 'transparent',
              border: `1.5px solid ${t.inputBdr}`,
              borderRadius: 10, padding: '10px 22px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              color: t.navText, fontFamily: t.font,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Take Photo
          </button>
        </div>
      </motion.div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileSelect} />
    </div>
  );
};

export default ImageUpload;
