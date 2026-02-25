import axios from 'axios';
import { logger } from '../monitoring/logger';

const api = axios.create({
  baseURL: process.env.NODE_ENV,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    logger.error('API Failure', error, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
    });

    return Promise.reject(error);
  },
);

export default api;
