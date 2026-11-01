import { apiGet, apiRequest } from './apiClient.js';
export const getDataset = (signal) => apiGet('/api/dataset', { signal });
export const solveRoute = (body, signal) => apiRequest('/api/route/optimize', { method: 'POST', body, signal });
// Historical pairwise endpoints remain available for comparison tools.
export const getHealth = () => apiGet('/api/health');
export const getLocations = () => apiGet('/api/locations');
export const getOptimization = () => apiGet('/api/route/optimize');
export const getOptimalRoute = () => apiGet('/api/route/optimal');
export const getAlternativeRoutes = () => apiGet('/api/routes/alternatives');
export const getAStar = (from, to) => apiGet(`/api/astar?${new URLSearchParams({ from, to })}`);
