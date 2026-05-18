import { authStorage } from './auth';

const API_BASE_URL = '';

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const token = authStorage.getToken();
    
    console.log('[adminApi] Request:', endpoint, options.method || 'GET');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    console.log('[adminApi] Response status:', response.status);

    const result = await response.json();
    
    console.log('[adminApi] Response data:', result);
    
    if (!response.ok) {
      console.error('[adminApi] Request failed:', result.error || `HTTP ${response.status}`);
      return {
        success: false,
        error: result.error || `HTTP ${response.status}`
      };
    }

    return result;
  } catch (error) {
    console.error('[adminApi] Request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

function buildQueryString(params: Record<string, any>): string {
  const filtered = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  
  return filtered ? `?${filtered}` : '';
}

export const adminApi = {
  stats: {
    get: () => request('/api/admin/stats'),
  },

  users: {
    getAll: (params?: { page?: number; limit?: number; search?: string; role?: string; status?: string }) =>
      request(`/api/admin/users${buildQueryString(params || {})}`),
    update: (id: string, data: any) =>
      request(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  },

  tracks: {
    getAll: (params?: { 
      page?: number; 
      limit?: number; 
      status?: string;
      artistId?: string;
    }) =>
      request(`/api/admin/tracks${buildQueryString(params || {})}`),
    
    getById: (id: string) =>
      request(`/api/admin/tracks/${id}`),
    
    create: (data: {
      title: string;
      slug: string;
      duration: number;
      audioUrl: string;
      cover?: string;
      artistId: string;
      genreIds?: string[];
      status?: string;
    }) =>
      request('/api/admin/tracks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id: string, data: Partial<{
      title: string;
      slug: string;
      duration: number;
      audioUrl: string;
      cover: string;
      artistId: string;
      genreIds: string[];
      status: string;
    }>) =>
      request(`/api/admin/tracks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    delete: (id: string) =>
      request(`/api/admin/tracks/${id}`, { method: 'DELETE' }),
    
    approve: (id: string) =>
      request(`/api/admin/tracks/${id}/approve`, { method: 'POST' }),
    
    reject: (id: string, reason: string) =>
      request(`/api/admin/tracks/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },

  artists: {
    getAll: (params?: { page?: number; limit?: number; search?: string }) =>
      request(`/api/admin/artists${buildQueryString(params || {})}`),
    getById: (id: string) =>
      request(`/api/admin/artists/${id}`),
    create: (data: any) =>
      request('/api/admin/artists', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      request(`/api/admin/artists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request(`/api/admin/artists/${id}`, { method: 'DELETE' }),
  },

  sheets: {
    getAll: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
      request(`/api/admin/sheets${buildQueryString(params || {})}`),
    create: (data: any) =>
      request('/api/admin/sheets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      request(`/api/admin/sheets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request(`/api/admin/sheets/${id}`, { method: 'DELETE' }),
    approve: (id: string) =>
      request(`/api/admin/sheets/${id}/approve`, { method: 'POST' }),
    reject: (id: string, reason: string) =>
      request(`/api/admin/sheets/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },

  genres: {
    getAll: (params?: { page?: number; limit?: number; search?: string }) =>
      request(`/api/admin/genres${buildQueryString(params || {})}`),
    
    create: (data: any) => {
      console.log('[adminApi.genres] Creating genre:', data);
      return request('/api/admin/genres', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    update: (id: string, data: any) => {
      console.log('[adminApi.genres] Updating genre:', id, data);
      return request(`/api/admin/genres/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    
    delete: (id: string) => {
      console.log('[adminApi.genres] Deleting genre:', id);
      return request(`/api/admin/genres/${id}`, { 
        method: 'DELETE' 
      });
    },
  },
};
