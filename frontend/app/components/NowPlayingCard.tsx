'use client';

interface Track {
  id: number;
  title: string;
  artist: string;
  duration: string;
  cover?: string;
}

interface NowPlayingCardProps {
  track: Track;
}

export default function NowPlayingCard({ track }: NowPlayingCardProps) {
  return (
    <div className="glass-strong rounded-3xl p-8 relative overflow-hidden">
      {/* Фон с блюром */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-pink-400/20 blur-3xl"></div>

      <div className="relative z-10 flex items-center gap-6">
        {/* Обложка с анимацией */}
        <div className="relative">
          <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-6xl shadow-2xl animate-float">
            {track.cover}
          </div>
          {/* Пульсирующее кольцо */}
          <div className="absolute inset-0 rounded-2xl border-4 border-purple-400 animate-ping opacity-75"></div>
        </div>

        {/* Информация */}
        <div className="flex-1">
          <p className="text-sm text-slate-600 mb-1 font-medium">
            СЕЙЧАС ИГРАЕТ
          </p>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">
            {track.title}
          </h2>
          <p className="text-lg text-slate-600">{track.artist}</p>

          {/* Эквалайзер анимация */}
          <div className="flex items-end gap-2 mt-4 h-8">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: `${0.5 + Math.random() * 0.5}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
