'use client';

import { useEffect, useState } from 'react';
import { Artist } from '@/app/types';
import { Users } from 'lucide-react';
import { authStorage } from '@/app/lib/auth';

import { toast } from '@/app/components/Toast';
interface AuthorHeaderProps {
  author: Artist;
}

function FollowButton({ slug }: { slug: string }) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) { setFollowing(false); return; }
    setAuthed(true);
    fetch(`/api/artists/${slug}/follow`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setFollowing(!!j.isFollowing))
      .catch(() => setFollowing(false));
  }, [slug]);

  const toggle = async () => {
    const token = authStorage.getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/artists/${slug}/follow`, {
        method: following ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (j.success) setFollowing(!following);
      else toast.error(j.error || 'Ошибка');
    } finally { setBusy(false); }
  };

  if (following === null) return null;

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`mt-4 px-6 py-2.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${
        following
          ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          : 'bg-[var(--text-primary)] text-white hover:bg-gray-800'
      }`}>
      {busy ? '…' : following ? '✓ Вы подписаны' : '+ Подписаться'}
    </button>
  );
}

export default function AuthorHeader({ author }: AuthorHeaderProps) {
  console.log('[AUTHOR HEADER] Rendering with author:', author.name);
  console.log('[AUTHOR HEADER] Avatar:', author.avatar);
  console.log('[AUTHOR HEADER] Cover:', author.coverImage);

  return (
    <div className="mb-4">
      {/* Только круглый аватар по центру */}
      <div className="flex flex-col items-center">
        <div className="relative mb-3">
          <div className="w-40 h-40 rounded-full overflow-hidden shadow-xl bg-gradient-to-br from-purple-100 to-pink-100 border-4 border-white">
            {author.avatar ? (
              <img
                src={author.avatar}
                alt={author.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('[AUTHOR HEADER] Avatar failed to load:', author.avatar);
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-full h-full flex items-center justify-center';
                    fallback.innerHTML = `<svg class="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`;
                    parent.appendChild(fallback);
                  }
                }}
                onLoad={() => {
                  console.log('[AUTHOR HEADER] Avatar loaded successfully:', author.avatar);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Users className="w-20 h-20 text-gray-300" />
              </div>
            )}
          </div>
        </div>

        {/* Name */}
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">
            {author.name}
          </h1>
          {author.slug && <FollowButton slug={author.slug} />}
        </div>
      </div>
    </div>
  );
}
