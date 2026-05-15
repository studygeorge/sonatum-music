'use client';

import { X, AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  count: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteConfirmModal({
  isOpen,
  count,
  onClose,
  onConfirm
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Подтвердите удаление
          </h2>
        </div>
        
        <p className="text-gray-600 mb-6">
          Вы уверены, что хотите удалить {count} {count === 1 ? 'артиста' : 'артистов'}?
          <br />
          <span className="text-red-600 font-medium">
            Все треки этих артистов также будут удалены.
          </span>
          <br />
          Это действие нельзя отменить.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            Удалить {count > 1 ? `(${count})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
