// Типы для музыкальных сущностей

export interface Track {
  id: number;
  title: string;
  artist: string;
  duration: string;
  cover?: string;
  album?: string;
  genre?: string;
  releaseYear?: number;
  plays?: number;
  likes?: number;
  audioUrl?: string;
}

export interface Playlist {
  id: number;
  name: string;
  description?: string;
  trackCount: number;
  cover: string;
  tracks?: Track[];
  createdAt?: string;
  updatedAt?: string;
  isPublic?: boolean;
  author?: string;
}

export interface Album {
  id: number;
  title: string;
  artist: string;
  cover: string;
  releaseDate: string;
  trackCount: number;
  genre?: string;
  tracks?: Track[];
}

export interface Artist {
  id: number;
  name: string;
  avatar: string;
  bio?: string;
  followers?: number;
  genres?: string[];
  topTracks?: Track[];
  albums?: Album[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  playlists?: Playlist[];
  likedTracks?: Track[];
  followedArtists?: Artist[];
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  isMuted: boolean;
  repeat: 'off' | 'one' | 'all';
  shuffle: boolean;
  queue: Track[];
}

export interface SearchResult {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
}
