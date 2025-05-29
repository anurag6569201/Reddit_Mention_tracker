import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_VISORA_MAIN_SERVER;

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});
