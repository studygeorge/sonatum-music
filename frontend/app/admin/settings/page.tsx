'use client';

import { Settings as SettingsIcon, Bell, Shield, Database, Mail } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Настройки
        </h1>
        <p className="text-gray-600">
          Управление системными настройками платформы
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* General */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Общие настройки</h2>
          </div>
          <p className="text-gray-600">Функционал в разработке...</p>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Уведомления</h2>
          </div>
          <p className="text-gray-600">Функционал в разработке...</p>
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Безопасность</h2>
          </div>
          <p className="text-gray-600">Функционал в разработке...</p>
        </div>

        {/* Database */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-semibold text-gray-900">База данных</h2>
          </div>
          <p className="text-gray-600">Функционал в разработке...</p>
        </div>

        {/* Email */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900">Email настройки</h2>
          </div>
          <p className="text-gray-600">Функционал в разработке...</p>
        </div>
      </div>
    </div>
  );
}
