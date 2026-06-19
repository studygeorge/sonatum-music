'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/app/lib/api';
import { PremiumModal } from "./PremiumModal";

import { toast } from '@/app/components/Toast';
interface CommentUser {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  likesCount: number;
  user: CommentUser;
  replies?: Comment[];
  _count?: { likes: number };
}

interface CommentsSectionProps {
  trackId: string;
  isPremium: boolean;
  user: { id: string } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин. назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч. назад`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} дн. назад`;
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDeclension(num: number, words: string[]) {
  const cases = [2, 0, 1, 1, 1, 2];
  return words[(num % 100 > 4 && num % 100 < 20) ? 2 : cases[(num % 10 < 5) ? Math.floor(num % 10) : 5]];
}

const getAllReplies = (comments: Comment[]): Comment[] => {
  let result: Comment[] = [];
  for (const c of comments) {
    result.push(c);
    if (c.replies && c.replies.length > 0) {
      result = result.concat(getAllReplies(c.replies));
    }
  }
  return result;
};

function getUserDisplayName(user: any): string {
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return user.nickname || user.username || 'Пользователь';
}

function Avatar({ user, size = 36 }: { user: any; size?: number }) {
  const displayName = getUserDisplayName(user);
  const initials = displayName.slice(0, 2).toUpperCase();
  return user.avatar
    ? <img src={user.avatar} alt={initials} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
    : <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-xs"
        style={{ width: size, height: size, background: 'linear-gradient(135deg,#667eea,#764ba2)', fontSize: size * 0.36 }}>
        {initials}
      </div>;
}

interface CommentItemProps {
  comment: Comment;
  depth: number;
  user: { id: string } | null;
  isPremium: boolean;
  trackId: string;
  onReportOpen: (type: string, id: string) => void;
  onReplyPost: (content: string, parentId: string) => Promise<void>;
  onDelete: (id: string) => void;
}

function CommentItem({ comment, depth, user, isPremium, trackId, onReportOpen, onReplyPost, onDelete }: CommentItemProps) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(comment._count?.likes ?? comment.likesCount ?? 0);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [visibleCount, setVisibleCount] = useState(3);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const allReplies = depth === 0 ? getAllReplies(comment.replies || []).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [];
  const visibleReplies = allReplies.slice(0, visibleCount);

  const handleLike = async () => {
    if (!user) return;
    if (liked) {
      await api.unlikeComment(comment.id);
      setLikes(l => Math.max(0, l - 1));
    } else {
      await api.likeComment(comment.id);
      setLikes(l => l + 1);
    }
    setLiked(!liked);
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setPosting(true);
    await onReplyPost(replyText.trim(), comment.id);
    setReplyText('');
    setShowReplyBox(false);
    setPosting(false);
  };

  return (
    <div className={`flex gap-2.5 ${depth > 0 ? 'ml-10 pt-3' : 'pt-4'}`}>
      <div className="flex-shrink-0 mt-0.5">
        <Avatar user={comment.user} size={depth === 0 ? 36 : 28} />
      </div>
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-[13px] text-[#1c1c1e]">
            {getUserDisplayName(comment.user)}
          </span>
          <span className="text-[11px] text-[var(--text-secondary)]">{timeAgo(comment.createdAt)}</span>
        </div>

        {/* Content */}
        <p className="text-[13.5px] text-[#1c1c1e] leading-relaxed mt-0.5 break-words">{comment.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-1.5">
          {/* Like */}
          <button
            onClick={handleLike}
            disabled={!user}
            className={`flex items-center gap-1 text-[11px] transition-colors ${liked ? 'text-red-500 font-semibold' : 'text-[var(--text-secondary)] hover:text-red-400'} disabled:opacity-40`}
          >
            <svg className="w-3.5 h-3.5" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {likes > 0 && <span>{likes}</span>}
          </button>

          {/* Reply */}
          {depth < 3 && (
            <button
              onClick={() => isPremium ? setShowReplyBox(!showReplyBox) : undefined}
              className={`text-[11px] font-medium transition-colors ${isPremium ? 'text-[var(--text-secondary)] hover:text-[#1c1c1e]' : 'text-gray-300 cursor-default'}`}
              title={isPremium ? undefined : 'Только для Premium'}
            >
              <span className="inline-flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5M4 9h11a5 5 0 015 5v3" /></svg>Ответить</span>
            </button>
          )}

          {/* Report */}
          <button
            onClick={() => onReportOpen('COMMENT', comment.id)}
            className="text-[11px] text-[var(--text-secondary)] hover:text-red-400 transition-colors ml-auto"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 21V4h11l-1.5 4L15 12H4" /></svg>
          </button>

          {/* Delete (только свой комментарий) */}
          {user?.id === comment.user.id && (
            <button
              onClick={() => setConfirmOpen(true)}
              title="Удалить"
              aria-label="Удалить комментарий"
              className="text-[11px] text-[var(--text-secondary)] hover:text-red-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReplyBox && (
          <div className="mt-2 flex gap-2">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Ваш ответ..."
              rows={2}
              className="flex-1 bg-black/5 rounded-xl px-3 py-2 text-[13px] outline-none resize-none border border-transparent focus:border-[var(--border)] transition-colors"
            />
            <button
              onClick={handleReply}
              disabled={posting || !replyText.trim()}
              className="self-end px-4 py-2 rounded-full bg-[#1c1c1e] text-white text-[12px] font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
            >
              {posting ? '...' : '→'}
            </button>
          </div>
        )}

        {/* Nested replies */}
        {depth === 0 && allReplies.length > 0 && (
          <div className="mt-2 text-sm">
            {!showReplies && (
              <button onClick={() => setShowReplies(true)} className="flex items-center gap-3 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[#1c1c1e] transition-colors mt-2">
                <div className="w-8 border-b-2 border-gray-300"></div>
                Показать {allReplies.length} {getDeclension(allReplies.length, ['ответ', 'ответа', 'ответов'])}
              </button>
            )}
            {showReplies && (
              <div className="mt-1 flex flex-col gap-1 -ml-10">
                {visibleReplies.map(reply => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    depth={1}
                    user={user}
                    isPremium={isPremium}
                    trackId={trackId}
                    onReportOpen={onReportOpen}
                    onReplyPost={onReplyPost}
                    onDelete={onDelete}
                  />
                ))}
                {visibleCount < allReplies.length && (
                  <button 
                    onClick={() => setVisibleCount(v => v + 3)} 
                    className="flex items-center gap-3 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[#1c1c1e] transition-colors mt-4 ml-10"
                  >
                    <div className="w-8 border-b-2 border-gray-300"></div>
                    Показать следующие комментарии
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} feature="Комментарии" />

    {confirmOpen && (
      <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
           onClick={() => setConfirmOpen(false)}>
        <div className="apple-card bg-white w-full max-w-xs p-5 shadow-2xl animate-fadeInUp text-center"
             onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base font-bold text-[#1c1c1e] mb-1">Удалить комментарий?</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mb-4">Это действие нельзя отменить.</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-5 py-2 rounded-full bg-[var(--hover)] text-[#1c1c1e] text-[13px] font-semibold hover:bg-gray-200 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => { setConfirmOpen(false); onDelete(comment.id); }}
              className="px-5 py-2 rounded-full bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-colors"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

export default function CommentsSection({ trackId, isPremium, user }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [sort, setSort] = useState<'new' | 'popular'>('new');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [visibleRootCount, setVisibleRootCount] = useState(3);

  // Write comment
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  // Report modal
  const [reportModal, setReportModal] = useState<{ type: string; id: string } | null>(null);
  const [reportReason, setReportReason] = useState('INAPPROPRIATE');
  const [reportDetails, setReportDetails] = useState('');

  const fetchComments = useCallback(async (newSort: 'new' | 'popular', newPage: number, append = false) => {
    if (newPage === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await api.getComments(trackId, newSort);
      if (res.success) {
        const data = res.data as any;
        const list: Comment[] = Array.isArray(data) ? data : (data?.data ?? []);
        const pag = data?.pagination;
        setHasMore(pag?.hasMore ?? false);
        setTotal(pag?.total ?? list.length);
        setComments(prev => append ? [...prev, ...list] : list);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [trackId]);

  useEffect(() => {
    setPage(1);
    setComments([]);
    setVisibleRootCount(3);
    fetchComments(sort, 1, false);
  }, [sort, fetchComments]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchComments(sort, next, true);
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    const res = await api.addComment(trackId, commentText.trim(), undefined);
    if (res.success) {
      setCommentText('');
      setPage(1);
      setVisibleRootCount(3);
      fetchComments(sort, 1, false);
    }
    setPosting(false);
  };

  const handleReplyPost = async (content: string, parentId: string) => {
    const res = await api.addComment(trackId, content, parentId);
    if (res.success) {
      setPage(1);
      fetchComments(sort, 1, false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const res = await api.deleteComment(commentId);
    if (res.success) {
      setPage(1);
      fetchComments(sort, 1, false);
    } else {
      toast.error(res.error || 'Не удалось удалить комментарий');
    }
  };

  const submitReport = async () => {
    if (!reportModal) return;
    const res = await api.report(reportModal.id, reportModal.type, reportReason, reportDetails);
    if (res.success) {
      toast.error('Жалоба отправлена. Спасибо!');
      setReportModal(null);
      setReportDetails('');
    }
  };

  return (
    <div className="mt-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black tracking-tight text-[#1c1c1e]">
          Комментарии {total > 0 && <span className="text-[var(--text-secondary)] font-medium text-lg ml-1">({total})</span>}
        </h2>
        <div className="flex items-center gap-1 bg-black/5 rounded-full p-1">
          {(['new', 'popular'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all ${sort === s ? 'bg-white shadow text-[#1c1c1e]' : 'text-[var(--text-secondary)] hover:text-[#1c1c1e]'}`}
            >
              {s === 'new' ? 'Новые' : 'Популярные'}
            </button>
          ))}
        </div>
      </div>

      {/* Write comment */}
      {user ? (
        isPremium ? (
          <div className="bg-black/[0.03] rounded-2xl p-4 mb-6 border border-[var(--border)]">
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Оставьте комментарий..."
              rows={3}
              className="w-full bg-transparent outline-none text-[14px] text-[#1c1c1e] placeholder:text-gray-400 resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handlePostComment}
                disabled={posting || !commentText.trim()}
                className="px-6 py-2 rounded-full bg-[#1c1c1e] text-white text-[13px] font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
              >
                {posting ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { window.location.href = "/profile?tab=subscription"; }}
            className="w-full text-left bg-gradient-to-br from-[#0039a6]/5 via-white to-[#2f9e8f]/5 border border-[var(--border)] hover:border-[#1c1c1e] rounded-2xl p-5 mb-6 transition group"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-[14px] text-[#1c1c1e]">Комментарии — для Premium-подписчиков</p>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1 leading-snug">Чтобы оставлять и отвечать на комментарии, оформите подписку Сонатум.</p>
              </div>
              <span className="shrink-0 px-5 py-2.5 rounded-full bg-[#1c1c1e] text-white text-[12px] font-semibold whitespace-nowrap group-hover:opacity-90 transition">
                Оформить
              </span>
            </div>
          </button>
        )
      ) : (
        <div className="bg-black/[0.03] border border-[var(--border)] rounded-2xl p-5 mb-6 text-center">
          <p className="text-[13px] text-[var(--text-secondary)]">
            <a href="/login" className="font-semibold text-[#1c1c1e] hover:underline">Войдите</a>, чтобы оставлять комментарии
          </p>
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--border)] border-t-[#1c1c1e] animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10 text-[var(--text-secondary)] text-[14px]">
          Пока нет комментариев. Будьте первым!
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {comments.slice(0, visibleRootCount).map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              user={user}
              isPremium={isPremium}
              trackId={trackId}
              onReportOpen={(type, id) => { setReportModal({ type, id }); setReportReason('INAPPROPRIATE'); setReportDetails(''); }}
              onReplyPost={handleReplyPost}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {(visibleRootCount < comments.length || hasMore) && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => {
              if (visibleRootCount < comments.length) {
                setVisibleRootCount(v => v + 3);
              } else {
                setVisibleRootCount(v => v + 3);
                loadMore();
              }
            }}
            disabled={loadingMore}
            className="px-8 py-2.5 rounded-full border border-[var(--border)] text-[13px] font-medium hover:bg-black/5 transition-colors disabled:opacity-40"
          >
            {loadingMore ? 'Загрузка...' : 'Показать ещё'}
          </button>
        </div>
      )}

      {/* Report modal */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setReportModal(null)} />
          <div className="relative z-10 bg-white rounded-[1.75rem] p-7 w-full max-w-md shadow-2xl border border-[var(--border)]">
            <h2 className="text-xl font-black mb-5 text-[#1c1c1e]">Пожаловаться</h2>
            <p className="text-[12px] text-[var(--text-secondary)] mb-3 uppercase tracking-wide font-semibold">Причина</p>
            <div className="flex flex-col gap-2 mb-4">
              {[
                { value: 'COPYRIGHT', label: 'Нарушение авторских прав' },
                { value: 'INAPPROPRIATE', label: 'Неприемлемый контент' },
                { value: 'METADATA', label: 'Неверные метаданные' },
                { value: 'TECHNICAL', label: 'Технические проблемы' },
                { value: 'OTHER', label: 'Другое' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
                  <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${reportReason === opt.value ? 'border-[#1c1c1e] bg-[#1c1c1e]' : 'border-gray-300 group-hover:border-gray-500'}`}
                    style={{ width: 18, height: 18 }}>
                    {reportReason === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" className="sr-only" value={opt.value} checked={reportReason === opt.value} onChange={() => setReportReason(opt.value)} />
                  <span className="text-[13px] text-[#1c1c1e]">{opt.label}</span>
                </label>
              ))}
            </div>
            <textarea
              value={reportDetails}
              onChange={e => setReportDetails(e.target.value)}
              placeholder="Опишите проблему подробнее (необязательно)..."
              rows={3}
              className="w-full bg-black/[0.04] rounded-xl px-3 py-2.5 text-[13px] outline-none resize-none mb-5 border border-transparent focus:border-[var(--border)] transition-colors"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setReportModal(null)} className="px-5 py-2 rounded-full border border-[var(--border)] text-[13px] hover:bg-black/5 transition-colors">Отмена</button>
              <button onClick={submitReport} className="px-6 py-2 rounded-full bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-colors">Пожаловаться</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
