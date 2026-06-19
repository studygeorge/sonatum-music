'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/app/lib/api';

import { toast } from '@/app/components/Toast';
export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await api.getGroups();
      if (res.success) {
        setGroups(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    const res = await api.createGroup({ name: newGroupName });
    setCreating(false);
    if (res.success) {
      setNewGroupName('');
      fetchGroups();
    } else {
      toast.error(res.error || 'Ошибка создания группы');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeGroup) return;
    setInviting(true);
    const res = await api.inviteToGroup(activeGroup.id, inviteEmail);
    setInviting(false);
    if (res.success) {
      setInviteEmail('');
      // Update active group members locally
      setActiveGroup({
        ...activeGroup,
        members: [...(activeGroup.members || []), res.data]
      });
      fetchGroups();
    } else {
      toast.error(res.error || 'Пользователь не найден или уже в группе');
    }
  };

  if (loading && !groups.length) {
    return <div className="min-h-screen pt-32 text-center text-gray-500">Загрузка групп...</div>;
  }

  return (
    <main className="min-h-screen pt-24 pb-12 bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
        
        {/* Left Col: Group List */}
        <div className="md:col-span-1 space-y-6">
          <div className="apple-card p-6 border-none shadow-sm bg-white">
            <h2 className="text-xl font-bold mb-4">Мои классы</h2>
            
            <form onSubmit={handleCreateGroup} className="mb-6 flex gap-2">
              <input 
                type="text" 
                placeholder="Название нового класса" 
                className="flex-grow p-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                disabled={creating}
              />
              <button 
                type="submit" 
                disabled={creating || !newGroupName.trim()}
                className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                +
              </button>
            </form>

            {groups.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">У вас пока нет групп. Создайте первую!</p>
            ) : (
              <div className="space-y-2">
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGroup(g)}
                    className={`w-full text-left p-3 rounded-xl transition ${activeGroup?.id === g.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`}
                  >
                    <div className="font-semibold text-sm text-[var(--text-primary)]">{g.name}</div>
                    <div className="text-xs text-gray-500 mt-1">Участников: {g.members?.length || 0}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Group Details */}
        <div className="md:col-span-2">
          {activeGroup ? (
            <div className="apple-card p-8 border-none shadow-sm bg-white min-h-[500px]">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{activeGroup.name}</h1>
                  <p className="text-sm text-gray-500 mt-2">Владелец: {activeGroup.owner?.firstName || activeGroup.owner?.username || 'Вы'}</p>
                </div>
                <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold">Учебная Группа</div>
              </div>

              <div className="border-t border-gray-100 pt-8 grid md:grid-cols-2 gap-8">
                {/* Members List */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    Ученики <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{activeGroup.members?.length || 0}</span>
                  </h3>
                  
                  {activeGroup.members?.length === 0 ? (
                    <p className="text-sm text-gray-500">В этой группе пока никого нет.</p>
                  ) : (
                    <div className="space-y-3">
                      {activeGroup.members?.map((m: any) => (
                        <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                          {m.user?.avatar ? (
                            <img src={m.user.avatar} alt="Avatar" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex flex-col items-center justify-center text-xs">
                              {m.user?.firstName?.[0] || 'S'}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium">{m.user?.firstName || m.user?.username || 'Студент'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Invite Form */}
                <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100 h-fit">
                  <h3 className="font-semibold text-gray-800 mb-2">Пригласить студента</h3>
                  <p className="text-xs text-gray-500 mb-4">Пользователь должен быть зарегистрирован в платформе.</p>
                  
                  <form onSubmit={handleInvite} className="space-y-3">
                    <input 
                      type="email" 
                      placeholder="Email студента" 
                      className="w-full p-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      disabled={inviting}
                    />
                    <button 
                      type="submit" 
                      disabled={inviting || !inviteEmail.trim()}
                      className="w-full apple-button text-sm bg-indigo-600 border-none hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {inviting ? 'Отправка...' : 'Отправить приглашение'}
                    </button>
                  </form>
                </div>
              </div>
              
              <div className="mt-12 bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 flex gap-3">
                <span className="text-blue-500 text-lg">ℹ️</span>
                <p>Вы можете делиться вашими аннотациями в нотном архиве специально для этой группы. В интерфейсе просмотра партитур при создании аннотации просто выберите этот класс из выпадающего списка.</p>
              </div>
            </div>
          ) : (
            <div className="apple-card p-6 border-none shadow-sm bg-white h-full flex flex-col items-center justify-center text-gray-400 min-h-[500px]">
              <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p>Выберите класс слева для просмотра деталей</p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
