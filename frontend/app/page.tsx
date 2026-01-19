'use client';

import { useEffect, useState } from 'react';

interface Track {
  id: number;
  title: string;
  artist: string;
  duration: string;
}

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3001/api/music')
      .then(res => res.json())
      .then(data => {
        setTracks(data.tracks);
        setLoading(false);
      })
      .catch(err => {
        console.error('Ошибка загрузки:', err);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            🎵 Sonatum Music
          </h1>
          <p className="text-xl text-gray-300">
            Добро пожаловать в мир музыки
          </p>
        </div>

        <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
          <h2 className="text-3xl font-semibold mb-6">Популярные треки</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
              <p className="mt-4">Загрузка...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tracks.map(track => (
                <div 
                  key={track.id}
                  className="bg-white/5 hover:bg-white/10 transition-all rounded-lg p-4 flex justify-between items-center cursor-pointer"
                >
                  <div>
                    <h3 className="font-semibold text-lg">{track.title}</h3>
                    <p className="text-gray-400">{track.artist}</p>
                  </div>
                  <span className="text-gray-300">{track.duration}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center mt-12 text-gray-400">
          <p>🚀 Проект запущен успешно!</p>
          <p className="text-sm mt-2">Backend: localhost:3001 | Frontend: localhost:3000</p>
        </div>
      </div>
    </main>
  );
}
