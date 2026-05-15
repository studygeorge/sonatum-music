'use client';

export default function WaveAnimation() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-10">
      <div className="absolute bottom-0 left-0 right-0">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="absolute bottom-0 left-0 right-0 h-32"
            style={{
              background: `linear-gradient(to top, rgba(0, 0, 0, ${0.1 - i * 0.05}), transparent)`,
              animation: `wave ${4 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>
      
      <style jsx>{`
        @keyframes wave {
          0%, 100% {
            transform: translateX(0) scaleY(1);
          }
          50% {
            transform: translateX(-25%) scaleY(1.1);
          }
        }
      `}</style>
    </div>
  );
}
