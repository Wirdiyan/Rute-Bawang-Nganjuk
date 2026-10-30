import { apiGet } from './apiClient.js';

export const getHealth = () => apiGet('/api/health');
export const getLocations = () => apiGet('/api/locations');
export const getOptimization = () => apiGet('/api/route/optimize');
export const getOptimalRoute = () => apiGet('/api/route/optimal');
export const getAlternativeRoutes = () => apiGet('/api/routes/alternatives');

export function getAStar(from, to) {
  const query = new URLSearchParams({ from, to });
  return apiGet(`/api/astar?${query.toString()}`);
}
