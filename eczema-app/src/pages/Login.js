// src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Google,
  LocalHospital,
  Healing,
  Favorite,
  Coronavirus,
  Email,
  Lock
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, signInWithGoogle } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const result = await login(formData.email, formData.password);

    if (result.success) {
      setSuccess('Welcome back! Redirecting to dashboard...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } else {
      // Better error messages
      const errorMsg = result.error || '';
      if (errorMsg.includes('user-not-found')) {
        setError('No account found with this email. Please sign up first.');
      } else if (errorMsg.includes('wrong-password') || errorMsg.includes('invalid-credential')) {
        setError('Invalid email or password. Please try again.');
      } else if (errorMsg.includes('too-many-requests')) {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Failed to sign in. Please check your credentials.');
      }
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    const result = await signInWithGoogle();

    if (result.success) {
      setSuccess('Welcome! Redirecting to dashboard...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } else {
      setError(result.error || 'Google Sign-In failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      style={{ width: '100%', height: '100%' }}
    >
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Floating animated medical icons */}
        <Box
          component={motion.div}
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          sx={{
            position: 'absolute',
            top: '10%',
            left: '8%',
            opacity: 0.3
          }}
        >
          <LocalHospital sx={{ fontSize: 60, color: 'white' }} />
        </Box>
        <Box
          component={motion.div}
          animate={{ y: [-15, 15, -15] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          sx={{
            position: 'absolute',
            top: '20%',
            right: '12%',
            opacity: 0.3
          }}
        >
          <Healing sx={{ fontSize: 50, color: 'white' }} />
        </Box>
        <Box
          component={motion.div}
          animate={{ y: [-12, 12, -12] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          sx={{
            position: 'absolute',
            bottom: '15%',
            left: '15%',
            opacity: 0.3
          }}
        >
          <Favorite sx={{ fontSize: 55, color: 'white' }} />
        </Box>
        <Box
          component={motion.div}
          animate={{ y: [-18, 18, -18] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          sx={{
            position: 'absolute',
            bottom: '25%',
            right: '10%',
            opacity: 0.3
          }}
        >
          <Coronavirus sx={{ fontSize: 65, color: 'white' }} />
        </Box>

        {/* Decorative circles */}
        <Box
          component={motion.div}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          sx={{
            position: 'absolute',
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.2)',
            top: '15%',
            right: '20%'
          }}
        />
        <Box
          component={motion.div}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.25, 0.45, 0.25]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          sx={{
            position: 'absolute',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.15)',
            bottom: '20%',
            left: '10%'
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Paper
              elevation={24}
              sx={{
                display: 'flex',
                borderRadius: 6,
                overflow: 'hidden',
                minHeight: '600px',
                background: 'white',
                boxShadow: '0 30px 80px rgba(0,0,0,0.3)'
              }}
            >
              {/* Left side - Illustration */}
              <Box
                sx={{
                  flex: '0 0 45%',
                  background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 4,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Decorative shapes */}
                <Box
                  sx={{
                    position: 'absolute',
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    background: 'rgba(30, 136, 229, 0.1)',
                    top: '-50px',
                    left: '-50px'
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    background: 'rgba(66, 165, 245, 0.1)',
                    bottom: '-30px',
                    right: '-30px'
                  }}
                />

                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 800,
                      color: '#1E88E5',
                      mb: 2,
                      textAlign: 'center',
                      position: 'relative',
                      zIndex: 1
                    }}
                  >
                    HELLO !
                  </Typography>
                </motion.div>
                
                {/* 3D Doctor Illustration */}
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Box
                    component={motion.img}
                    animate={{ y: [-10, 10, -10] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    src="/logo.png"
                    alt="Doctor"
                    sx={{
                      width: '100%',
                      maxWidth: '400px',
                      mb: 3,
                      position: 'relative',
                      zIndex: 1,
                      filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.15))'
                    }}
                  />
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      color: '#1565C0',
                      textAlign: 'center',
                      fontWeight: 500,
                      position: 'relative',
                      zIndex: 1
                    }}
                  >
                    Please enter your details
                    <br />
                    to continue
                  </Typography>
                </motion.div>
              </Box>

              {/* Right side - Login Form */}
              <Box
                sx={{
                  flex: '0 0 55%',
                  p: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
              >
                <motion.div
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, justifyContent: 'flex-end' }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#26C6DA' }}>
                      Skin
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 400, color: '#666', ml: 1 }}>
                      Sight
                    </Typography>
                  </Box>
                </motion.div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                      {error}
                    </Alert>
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
                      {success}
                    </Alert>
                  </motion.div>
                )}

                <motion.form
                  onSubmit={handleSubmit}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                    Username or E-mail
                  </Typography>
                  <TextField
                    fullWidth
                    name="email"
                    type="email"
                    placeholder="example@gmail.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email sx={{ color: '#1E88E5' }} />
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#F5F7FA',
                        '& fieldset': { borderColor: '#E0E0E0' }
                      }
                    }}
                  />

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                    Password
                  </Typography>
                  <TextField
                    fullWidth
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: '#1E88E5' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            disabled={loading}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      mb: 1,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#F5F7FA',
                        '& fieldset': { borderColor: '#E0E0E0' }
                      }
                    }}
                  />

                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    component={motion.button}
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    sx={{
                      py: 1.5,
                      mt: 3,
                      mb: 2,
                      fontSize: '1rem',
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #64B5F6 0%, #42A5F5 100%)',
                      borderRadius: 3,
                      textTransform: 'none',
                      boxShadow: '0 4px 15px rgba(66, 165, 245, 0.4)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #42A5F5 0%, #1E88E5 100%)',
                        boxShadow: '0 6px 20px rgba(66, 165, 245, 0.6)',
                      },
                      '&:disabled': {
                        background: 'linear-gradient(135deg, #B0BEC5 0%, #90A4AE 100%)',
                        boxShadow: 'none'
                      }
                    }}
                  >
                    {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Log In'}
                  </Button>

                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Link
                      to="/forgot-password"
                      style={{
                        color: '#26C6DA',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        fontWeight: 500
                      }}
                    >
                      Forget Password?
                    </Link>
                  </Box>

                  <Divider sx={{ my: 3 }}>
                    <Typography variant="body2" color="text.secondary">OR</Typography>
                  </Divider>

                  <Button
                    fullWidth
                    type="button"
                    variant="outlined"
                    size="large"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    startIcon={<Google />}
                    component={motion.button}
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    sx={{
                      py: 1.5,
                      borderColor: '#E0E0E0',
                      color: '#666',
                      fontWeight: 600,
                      textTransform: 'none',
                      borderRadius: 3,
                      '&:hover': {
                        borderColor: '#1E88E5',
                        backgroundColor: 'rgba(30, 136, 229, 0.04)'
                      },
                      '&:disabled': {
                        borderColor: '#E0E0E0',
                        color: '#999'
                      }
                    }}
                  >
                    Sign in with Google
                  </Button>

                  <Box sx={{ textAlign: 'center', mt: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Do Not Have Account?{' '}
                      <Link
                        to="/signup"
                        style={{
                          color: '#26C6DA',
                          textDecoration: 'none',
                          fontWeight: 600
                        }}
                      >
                        Sign Up
                      </Link>
                    </Typography>
                  </Box>
                </motion.form>
              </Box>
            </Paper>
          </motion.div>
        </Container>
      </Box>
    </motion.div>
  );
};

export default Login;
