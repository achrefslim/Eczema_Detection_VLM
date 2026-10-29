// src/pages/SignUp.js
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Divider,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person,
  Email,
  Lock,
  LocalHospital,
  Healing,
  Favorite,
  Coronavirus,
  MedicalServices
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const SignUp = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'doctor',
    agreeToTerms: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });

    setError('');
    setSuccess('');
  };

  const validateForm = () => {
    // Check empty fields
    if (!formData.fullName || !formData.email || !formData.password || !formData.confirmPassword) {
      return 'Please fill in all fields';
    }

    // Name validation
    if (formData.fullName.trim().length < 3) {
      return 'Full name must be at least 3 characters';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }

    // Password validation
    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters';
    }

    // Password match validation
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }

    // Terms validation
    if (!formData.agreeToTerms) {
      return 'Please agree to the medical data privacy policy';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    const result = await signup(
      formData.email,
      formData.password,
      formData.fullName,
      formData.role
    );

    if (result.success) {
      setSuccess('Account created successfully! Redirecting to dashboard...');
      // Clear form
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'doctor',
        agreeToTerms: false
      });
      // Navigate to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } else {
      // Better error messages
      const errorMsg = result.error || '';
      if (errorMsg.includes('email-already-in-use')) {
        setError('This email is already registered. Please sign in instead.');
      } else if (errorMsg.includes('weak-password')) {
        setError('Password is too weak. Please use a stronger password.');
      } else if (errorMsg.includes('invalid-email')) {
        setError('Invalid email format. Please check your email.');
      } else {
        setError('Failed to create account. Please try again.');
      }
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
          overflow: 'hidden',
          py: 4
        }}
      >
        {/* Floating Icons */}
        <Box
          component={motion.div}
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          sx={{ position: 'absolute', top: '10%', left: '8%', opacity: 0.3 }}
        >
          <LocalHospital sx={{ fontSize: 60, color: 'white' }} />
        </Box>

        <Box
          component={motion.div}
          animate={{ y: [-15, 15, -15] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          sx={{ position: 'absolute', top: '20%', right: '12%', opacity: 0.3 }}
        >
          <Healing sx={{ fontSize: 50, color: 'white' }} />
        </Box>

        <Box
          component={motion.div}
          animate={{ y: [-12, 12, -12] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          sx={{ position: 'absolute', bottom: '15%', left: '15%', opacity: 0.3 }}
        >
          <Favorite sx={{ fontSize: 55, color: 'white' }} />
        </Box>

        <Box
          component={motion.div}
          animate={{ y: [-18, 18, -18] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          sx={{ position: 'absolute', bottom: '25%', right: '10%', opacity: 0.3 }}
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

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Paper
              elevation={24}
              sx={{
                display: 'flex',
                borderRadius: 6,
                overflow: 'hidden',
                minHeight: 650,
                background: 'white',
                boxShadow: '0 30px 80px rgba(0,0,0,0.3)'
              }}
            >
              {/* Left Illustration */}
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
                    WELCOME !
                  </Typography>
                </motion.div>

                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Box
                    component={motion.img}
                    src="/logo.png"
                    alt="Doctor"
                    animate={{ y: [-10, 10, -10] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    sx={{
                      width: '100%',
                      maxWidth: 400,
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
                    Join our AI-powered
                    <br />
                    medical platform
                  </Typography>
                </motion.div>
              </Box>

              {/* Form */}
              <Box
                sx={{
                  flex: '0 0 55%',
                  p: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  overflowY: 'auto',
                  maxHeight: '105vh'
                }}
              >
                <motion.div
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >

                </motion.div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                      {error}
                    </Alert>
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
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
                    Full Name
                  </Typography>
                  <TextField
                    fullWidth
                    name="fullName"
                    placeholder="Dr. John Smith"
                    value={formData.fullName}
                    onChange={handleChange}
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person sx={{ color: '#1E88E5' }} />
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#F5F7FA',
                        '& fieldset': { borderColor: '#E0E0E0' }
                      }
                    }}
                  />

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                    Email Address
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
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#F5F7FA',
                        '& fieldset': { borderColor: '#E0E0E0' }
                      }
                    }}
                  />

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                    Role
                  </Typography>
                  <FormControl
                    fullWidth
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#F5F7FA',
                        '& fieldset': { borderColor: '#E0E0E0' }
                      }
                    }}
                  >
                    <Select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      disabled={loading}
                      startAdornment={
                        <InputAdornment position="start">
                          <MedicalServices sx={{ color: '#1E88E5', ml: 1 }} />
                        </InputAdornment>
                      }
                    >
                      <MenuItem value="doctor">Doctor</MenuItem>
                      <MenuItem value="researcher">Researcher</MenuItem>
                      <MenuItem value="nurse">Nurse</MenuItem>
                      <MenuItem value="admin">Administrator</MenuItem>
                    </Select>
                  </FormControl>

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
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#F5F7FA',
                        '& fieldset': { borderColor: '#E0E0E0' }
                      }
                    }}
                    helperText="Minimum 6 characters"
                  />

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                    Confirm Password
                  </Typography>
                  <TextField
                    fullWidth
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
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
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                            disabled={loading}
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#F5F7FA',
                        '& fieldset': { borderColor: '#E0E0E0' }
                      }
                    }}
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        name="agreeToTerms"
                        checked={formData.agreeToTerms}
                        onChange={handleChange}
                        disabled={loading}
                        sx={{ color: '#1E88E5', '&.Mui-checked': { color: '#1E88E5' } }}
                      />
                    }
                    label={
                      <Typography variant="body2" color="text.secondary">
                        I agree to medical data privacy policy
                      </Typography>
                    }
                    sx={{ mb: 2 }}
                  />

                  {/* MATCHING BUTTON STYLE FROM LOGIN PAGE */}
                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="small"
                    disabled={loading}
                    component={motion.button}
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    sx={{
                      py: 1.5,
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
                    {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Create Account'}
                  </Button>

                  <Box sx={{ textAlign: 'center', mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Already have an account?{' '}
                      <Link
                        to="/login"
                        style={{
                          color: '#26C6DA',
                          textDecoration: 'none',
                          fontWeight: 600
                        }}
                      >
                        Sign In
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

export default SignUp;
