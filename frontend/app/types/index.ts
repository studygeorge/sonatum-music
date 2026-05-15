// frontend/app/types/index.ts

export type UserRole = 'USER' | 'ARTIST' | 'ADMIN' | 'SUPER_ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DELETED';
export type ContentStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string | null;
  description?: string;
  _count?: {
    tracks: number;
    artists: number;
  };
}

export interface Album {
  id: string;
  title: string;
  slug: string;
  cover?: string;
  releaseDate: string;
  trackCount: number;
  artistId: string;
  artist?: Artist;
  tracks?: Track[];
  createdAt: string;
  updatedAt: string;
}

export interface Artist {
  id: string;
  userId: string;
  name: string;
  slug: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  region?: string;
  city?: string;
  foundedYear?: number;
  verified: boolean;
  followers: number;
  canSellMusic: boolean;
  socialLinks?: {
    vk?: string;
    telegram?: string;
    youtube?: string;
    instagram?: string;
    website?: string;
  };
  user?: User;
  genres?: Genre[];
  tracks?: Track[];
  albums?: Album[];
  _count?: {
    tracks: number;
    albums: number;
    followers: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Track {
  id: string;
  title: string;
  slug: string;
  duration: number;
  audioUrl: string;
  cover?: string;
  bpm?: number;
  key?: string;
  price?: number;
  isFree: boolean;
  isForSale: boolean;
  format: string;
  playCount: number;
  likeCount: number;
  releaseDate: string;
  isExplicit: boolean;
  status: ContentStatus;
  artistId: string;
  albumId?: string;
  artist: {
    id: string;
    name: string;
    slug: string;
    avatar?: string;
    verified: boolean;
  };
  album?: {
    id: string;
    title: string;
    slug: string;
    cover?: string;
  };
  genres: Genre[];
  tags?: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  cover?: string;
  isPublic: boolean;
  userId: string;
  trackCount: number;
  duration: number;
  user?: User;
  tracks?: PlaylistTrack[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistTrack {
  id: string;
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: string;
  track?: Track;
}

export interface Purchase {
  id: string;
  userId: string;
  trackId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  user?: User;
  track?: Track;
  createdAt: string;
  updatedAt: string;
}
