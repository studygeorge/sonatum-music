'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/app/lib/api';
import { Artist, Track } from '@/app/types';
import Header from '@/app/components/Header';
import AuthorHeader from './components/AuthorHeader';
import AuthorInfo from './components/AuthorInfo';
import AuthorTracks from './components/AuthorTracks';
import { usePlayer } from '@/app/context/PlayerContext';
import Link from 'next/link';

export default function AuthorPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { playTrack } = usePlayer();

  const [author, setAuthor] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadAuthorData();
    }
  }, [slug]);

  const loadAuthorData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[AUTHOR PAGE] Loading data for slug:', slug);

      const authorResponse = await api.getArtist(slug);
      
      console.log('[AUTHOR PAGE] Full response:', authorResponse);
      console.log('[AUTHOR PAGE] Response.data:', authorResponse.data);

      if (authorResponse.success && authorResponse.data) {
        let authorData = authorResponse.data as any;
        
        if (authorData.data) {
          console.log('[AUTHOR PAGE] Data nested in data.data');
          authorData = authorData.data;
        }
        
        console.log('[AUTHOR PAGE] Extracted author data:', authorData);
        console.log('[AUTHOR PAGE] Author name:', authorData.name);
        console.log('[AUTHOR PAGE] Avatar URL:', authorData.avatar);
        console.log('[AUTHOR PAGE] Cover URL:', authorData.coverImage);
        console.log('[AUTHOR PAGE] Author ID:', authorData.id);
        console.log('[AUTHOR PAGE] Tracks field:', authorData.tracks);
        
        setAuthor(authorData);
        
        if (authorData.tracks && Array.isArray(authorData.tracks)) {
          console.log('[AUTHOR PAGE] Setting tracks from author data:', authorData.tracks.length);
          console.log('[AUTHOR PAGE] First track:', authorData.tracks[0]);
          setTracks(authorData.tracks);
        } else {
          console.log('[AUTHOR PAGE] No tracks field in author data');
          setTracks([]);
        }
      } else {
        console.error('[AUTHOR PAGE] Failed response:', authorResponse);
        setError('Автор не найден');
      }
    } catch (err) {
      console.error('[AUTHOR PAGE] Error:', err);
      setError('Ошибка загрузки данных автора');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayTrack = (track: Track) => {
    console.log('[AUTHOR PAGE] Playing track:', track.title);
    playTrack(track);
  };

  const handleLikeTrack = async (track: Track) => {
    try {
      await api.likeTrack(track.id);
      console.log('[AUTHOR PAGE] Liked track:', track.title);
    } catch (error) {
      console.error('[AUTHOR PAGE] Failed to like track:', error);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen pb-20 pt-4">
          <div className="max-w-6xl mx-auto px-4">
            <div className="animate-pulse mb-4">
              <div className="flex flex-col items-center">
                <div className="w-40 h-40 bg-gray-200 rounded-full mb-3"></div>
                <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
            </div>

            <div className="bg-gray-200 rounded-2xl h-28 mb-4 animate-pulse"></div>

            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !author) {
    return (
      <>
        <Header />
        <div className="min-h-screen pb-20 pt-4">
          <div className="max-w-6xl mx-auto px-4">
            <div className="liquid-glass rounded-2xl p-6 text-center">
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                {error || 'Автор не найден'}
              </h1>
              <Link href="/catalog">
                <button className="mt-3 px-5 py-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors text-sm">
                  Вернуться в каталог
                </button>
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  console.log('[AUTHOR PAGE] Rendering with author:', author.name);
  console.log('[AUTHOR PAGE] Rendering with tracks:', tracks.length);

  return (
    <>
      <Header />
      <div className="min-h-screen pb-20 pt-4">
        <div className="max-w-6xl mx-auto px-4">
          <AuthorHeader author={author} />
          <AuthorInfo author={author} />
          <AuthorTracks 
            tracks={tracks} 
            onPlay={handlePlayTrack}
            onLike={handleLikeTrack}
          />
        </div>
      </div>
    </>
  );
}
