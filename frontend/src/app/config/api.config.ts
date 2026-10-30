
const LOCAL_API_URL = 'http://localhost:3000';
const PRODUCTION_API_URL = 'https://devtrack-backend-x9cq.onrender.com';

export const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? LOCAL_API_URL
    : PRODUCTION_API_URL;
