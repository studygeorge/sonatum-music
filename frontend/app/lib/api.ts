// frontend/app/lib/api.ts

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    role: string;
    status: string;
  };
}

interface RegisterResponse extends LoginResponse {}

interface CatalogParams {
  search?: string;
  genres?: string[];
  regions?: string[];
  priceMin?: number;
  priceMax?: number;
  isFree?: boolean;
  isForSale?: boolean;
  sortBy?: 'popularity' | 'likes' | 'price' | 'title' | 'artist' | 'releaseDate';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  status?: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CatalogResponse {
  tracks: any[];
  pagination: PaginationMeta;
}

class APIClient {
  private baseURL: string;

  constructor() {
    this.baseURL = '';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = typeof window !== 'undefined' 
        ? localStorage.getItem('sonatum_token') 
        : null;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      };

      console.log('[API] Request:', endpoint);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      console.log('[API] Response:', endpoint, data);

      if (!response.ok) {
        // Передаём весь объект ошибки целиком, чтобы UI мог обработать спец-флаги
        // (например, requires2FA, code: 'PLAYLIST_LIMIT_REACHED')
        return {
          success: false,
          error: data.error || 'Произошла ошибка',
          data: data as any,
        };
      }

      // Если ответ имеет структуру { success: true, data: {...} }
      // возвращаем как есть, иначе оборачиваем
      if (data.success !== undefined) {
        return data;
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('[API] Error:', endpoint, error);
      return {
        success: false,
        error: 'Ошибка сети',
      };
    }
  }

  async register(
    email: string,
    password: string,
    username: string,
    firstName?: string,
    lastName?: string,
    extras?: {
      role?: 'USER' | 'ARTIST';
      regionId?: string;
      agreedTerms?: boolean;
      artistData?: {
        name?: string;
        slug?: string;
        authorType?: 'COMPOSER' | 'PERFORMER' | 'BOTH' | 'AUTHOR';
        isCollective?: boolean;
      };
    }
  ): Promise<ApiResponse<RegisterResponse>> {
    return this.request<RegisterResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email, password, username, firstName, lastName,
        role: extras?.role,
        regionId: extras?.regionId,
        agreedTerms: extras?.agreedTerms,
        artistData: extras?.artistData,
      }),
    });
  }

  async login(email: string, password: string, code?: string): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, code }),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.request<void>('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getMe(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/auth/me');
  }

  async subscribe(tier: 'PREMIUM' | 'STUDENT'): Promise<ApiResponse<any>> {
    return this.request<any>('/api/users/me/subscription', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  }

  async getCatalog(params: CatalogParams = {}): Promise<ApiResponse<CatalogResponse>> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v.toString()));
        } else {
          queryParams.append(key, value.toString());
        }
      }
    });

    return this.request<CatalogResponse>(`/api/catalog?${queryParams.toString()}`);
  }

  async getGenres(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/api/genres');
  }

  async getArtists(params: any = {}): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return this.request<any>(`/api/artists?${queryParams.toString()}`);
  }

  async getArtist(slug: string): Promise<ApiResponse<any>> {
    console.log('[API] getArtist called with slug:', slug);
    const response = await this.request<any>(`/api/artists/${slug}`);
    console.log('[API] getArtist response:', response);
    return response;
  }

  async getTrack(slug: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/tracks/${slug}`);
  }

  async likeTrack(trackId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/likes/${trackId}`, {
      method: 'POST',
    });
  }

  async unlikeTrack(trackId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/likes/${trackId}`, {
      method: 'DELETE',
    });
  }

  async getPlaylists(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/api/playlists');
  }

  async getPlaylist(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/playlists/${id}`);
  }

  async createPlaylist(data: any): Promise<ApiResponse<any>> {
    return this.request<any>('/api/playlists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ trackId }),
    });
  }

  async getPurchases(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/api/purchases');
  }

  async createPurchase(trackId: string): Promise<ApiResponse<any>> {
    return this.request<any>('/api/purchases', {
      method: 'POST',
      body: JSON.stringify({ trackId }),
    });
  }

  async getAdminStats(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/admin/stats');
  }

  async getAdminTracks(params: any = {}): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams(params);
    return this.request<any>(`/api/admin/tracks?${queryParams.toString()}`);
  }

  async approveTrack(trackId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/admin/tracks/${trackId}/approve`, {
      method: 'POST',
    });
  }

  async rejectTrack(trackId: string, reason: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/admin/tracks/${trackId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // --- Comments & Reports ---
  async getComments(trackId: string, sort: string = 'new'): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/tracks/${trackId}/comments?sort=${sort}`);
  }

  async addComment(trackId: string, content: string, parentId?: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/tracks/${trackId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId }),
    });
  }

  async likeComment(commentId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/comments/${commentId}/like`, {
      method: 'POST',
    });
  }

  async unlikeComment(commentId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/comments/${commentId}/like`, {
      method: 'DELETE',
    });
  }

  async deleteComment(commentId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  async report(targetId: string, targetType: string, reason: string, details?: string): Promise<ApiResponse<any>> {
    return this.request<any>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ targetId, targetType, reason, details }),
    });
  }

  async shuffleQueue(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/users/me/queue/shuffle', {
      method: 'POST',
    });
  }

  // --- Sheet Music ---
  async getSheetsFilters(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/sheets/filters');
  }

  async getSheetsSearch(params: Record<string, any> = {}): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });
    return this.request<any>(`/api/sheets/search?${queryParams.toString()}`);
  }

  async getSheetMusic(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/sheets/${id}`);
  }

  async getSheetAnnotations(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/sheets/${id}/annotations`);
  }

  async addSheetAnnotation(id: string, data: any): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/sheets/${id}/annotations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteSheetAnnotation(sheetId: string, annotationId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/sheets/${sheetId}/annotations/${annotationId}`, {
      method: 'DELETE',
    });
  }

  // --- Edu Groups API ---
  async getGroups(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/groups');
  }

  async createGroup(data: { name: string, description?: string }): Promise<ApiResponse<any>> {
    return this.request<any>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async inviteToGroup(groupId: string, email: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/groups/${groupId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // --- Admin API ---
  async getAdminSheets(status: string = 'PENDING'): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/admin/sheets?status=${status}`);
  }

  async verifySheet(id: string, status: 'APPROVED' | 'REJECTED' | 'PENDING'): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/admin/sheets/${id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async getAdminReports(status: string = 'PENDING'): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/admin/reports?status=${status}`);
  }
}

export const api = new APIClient();
export type { ApiResponse, LoginResponse, RegisterResponse, CatalogParams, CatalogResponse };
