'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artist: {
    name: string;
  };
}

interface RejectTrackModalProps {
  isOpen: boolean;
  track: Track | null;
  onClose: () => void;
  onSubmit: (trackId: string, reason: string) => Promise<void>;
}

export default function RejectTrackModal({
  isOpen,
  track,
  onClose,
  onSubmit
}: RejectTrackModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!track || !reason.trim()) {
      alert('Укажите причину отклонения');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(track.id, reason);
      setReason('');
      onClose();
    } catch (error) {
      console.error('Error rejecting track:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            Отклонить трек
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-gray-600 mb-4">
          Трек: <strong>{track.title}</strong><br />
          Артист: <strong>{track.artist.name}</strong>
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Причина отклонения
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Укажите причину отклонения трека..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Отклонение...' : 'Отклонить'}
          </button>
        </div>
      </div>
    </div>
  );
}