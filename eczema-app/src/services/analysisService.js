// src/services/analysisService.js
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// ─────────────────────────────────────────────
// Run the full AI analysis pipeline
// Called from Dashboard.js → handlePatientDataSubmit
// ─────────────────────────────────────────────
export const analyzeImage = async (imageFile, patientInfo) => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);

    // userId comes from Firebase Auth — passed by the caller
    formData.append('userId', patientInfo.userId || 'anonymous');

    // Patient details as one JSON string
    const patientData = {
      name:        patientInfo.patientName || patientInfo.name || 'Unknown',
      age:         patientInfo.patientAge  || patientInfo.age  || 'Unknown',
      duration:    patientInfo.duration    || '',
      description: patientInfo.description || ''
    };
    formData.append('patientData', JSON.stringify(patientData));

    const response = await axios.post(`${API_BASE_URL}/analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000 // 3 minutes — pipeline can be slow
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[analyzeImage] error:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Analysis failed'
    };
  }
};

// ─────────────────────────────────────────────
// Fetch history for the logged-in user
// Called from ReportsHistory.js
// ─────────────────────────────────────────────
export const getUserHistory = async (userId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/history/${userId}`);
    return {
      success: true,
      data: response.data.data || []
    };
  } catch (error) {
    console.error('[getUserHistory] error:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

// ─────────────────────────────────────────────
// Fetch one full report (with images) by DB id
// Called from ReportsHistory when user clicks "View"
// ─────────────────────────────────────────────
export const getReportDetail = async (reportId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/report/${reportId}`);
    return {
      success: true,
      data: response.data.data
    };
  } catch (error) {
    console.error('[getReportDetail] error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ─────────────────────────────────────────────
// Download the PDF for a report
// Called from ReportsHistory download button
// ─────────────────────────────────────────────
export const downloadReport = async (reportId, patientName) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/download/${reportId}`, {
      responseType: 'blob'
    });

    const url  = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', `skinsight_report_${patientName || reportId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('[downloadReport] error:', error);
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────
// Delete a report
// ─────────────────────────────────────────────
export const deleteReport = async (reportId, userId) => {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/report/${reportId}?userId=${userId}`
    );
    return { success: true };
  } catch (error) {
    console.error('[deleteReport] error:', error);
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────
// Health check — useful to test if backend is up
// ─────────────────────────────────────────────
export const checkBackendHealth = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    return response.data;
  } catch {
    return { status: 'error', server: 'unreachable' };
  }
};
