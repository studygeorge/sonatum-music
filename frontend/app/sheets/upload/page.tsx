'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/app/lib/api';

const INSTRUMENTS = ['Фортепиано', 'Скрипка', 'Альт', 'Виолончель', 'Контрабас', 'Флейта', 'Гобой', 'Кларнет', 'Фагот', 'Саксофон', 'Труба', 'Тромбон', 'Валторна', 'Туба', 'Гитара', 'Арфа', 'Орган', 'Хор'];
const DIFFICULTY_LEVELS = ['Начальный', 'Средний', 'Высокий', 'Профессиональный'];

interface SheetPart {
  instrument: string;
  file: File | null;
}

export default function SheetUploadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1
  const [title, setTitle] = useState('');
  const [instrumentation, setInstrumentation] = useState('');
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [arrangerSelf, setArrangerSelf] = useState(true);
  const [arrangerName, setArrangerName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [difficulty, setDifficulty] = useState(DIFFICULTY_LEVELS[0]);

  // Step 2
  const [scoreFile, setScoreFile] = useState<File | null>(null);
  const [parts, setParts] = useState<SheetPart[]>([]);
  const scoreRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [confirmArranging, setConfirmArranging] = useState(false);
  const [confirmOriginal, setConfirmOriginal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const toggleInstrument = (inst: string) =>
    setSelectedInstruments(prev => prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]);

  const addPart = () => setParts(prev => [...prev, { instrument: '', file: null }]);
  const removePart = (i: number) => setParts(prev => prev.filter((_, idx) => idx !== i));
  const updatePart = (i: number, field: keyof SheetPart, value: any) =>
    setParts(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));

  const canProceed1 = title.trim() && selectedInstruments.length > 0 && year && difficulty && (arrangerSelf || arrangerName.trim());
  const canProceed2 = !!scoreFile;
  const canProceed3 = confirmArranging && confirmOriginal;

  const handleSubmit = async () => {
    if (!canProceed3) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('instrumentation', instrumentation || selectedInstruments.join(', '));
      formData.append('instruments', JSON.stringify(selectedInstruments));
      formData.append('arranger', arrangerSelf ? 'self' : arrangerName);
      formData.append('year', year);
      formData.append('difficulty', difficulty.toUpperCase());
      if (scoreFile) formData.append('score', scoreFile);
      parts.filter(p => p.file).forEach((p, i) => {
        formData.append(`part_${i}_instrument`, p.instrument);
        formData.append(`part_${i}_file`, p.file!);
      });

      // POST to backend sheets API
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.sonatum-music.ru'}/api/sheets`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (res.ok) setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2, 3].map(s => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all ${s < step ? 'bg-green-500 text-white' : s === step ? 'bg-[#1c1c1e] text-white' : 'bg-black/10 text-[var(--text-secondary)]'}`}>
            {s < step ? '✓' : s}
          </div>
          {s < 3 && <div className={`h-0.5 w-8 rounded-full transition-all ${s < step ? 'bg-green-500' : 'bg-black/10'}`} />}
        </div>
      ))}
      <span className="ml-2 text-[12px] text-[var(--text-secondary)] font-medium">Шаг {step} из 3</span>
    </div>
  );

  if (done) return (
    <main className="min-h-screen pt-28 pb-20 px-4 flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🎼</div>
        <h1 className="text-2xl font-black text-[#1c1c1e] mb-2">Ноты отправлены!</h1>
        <p className="text-[var(--text-secondary)] text-[14px] mb-6">После модерации они появятся на странице трека.</p>
        <button onClick={() => router.back()} className="px-6 py-2.5 rounded-full bg-[#1c1c1e] text-white text-[13px] font-semibold hover:opacity-80 transition-opacity">← Вернуться</button>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen pt-24 pb-20 px-4 md:px-8 max-w-2xl mx-auto">
      <button onClick={() => step > 1 ? setStep(s => s - 1) : router.back()} className="mb-6 text-[13px] text-[var(--text-secondary)] hover:text-[#1c1c1e] transition-colors flex items-center gap-1.5 font-medium">
        ← {step > 1 ? 'Назад' : 'Отмена'}
      </button>

      <h1 className="text-3xl font-black tracking-tight text-[#1c1c1e] mb-1">🎼 Загрузка нот</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-7">Поделитесь нотной версией со слушателями Сонатума</p>

      <StepIndicator />

      <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-[var(--border)] p-7 shadow-sm">

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <h2 className="text-[18px] font-black text-[#1c1c1e]">Основная информация</h2>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Название партитуры *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="например, Сюита для скрипки и фортепиано"
                className="w-full mt-1.5 px-4 py-3 rounded-xl border border-[var(--border)] bg-white/80 text-[14px] outline-none focus:border-[#1c1c1e] transition-colors" />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Инструментовка (описание)</label>
              <input value={instrumentation} onChange={e => setInstrumentation(e.target.value)} placeholder="например, Скрипка и фортепиано"
                className="w-full mt-1.5 px-4 py-3 rounded-xl border border-[var(--border)] bg-white/80 text-[14px] outline-none focus:border-[#1c1c1e] transition-colors" />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Инструменты * (выберите)</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {INSTRUMENTS.map(inst => (
                  <button key={inst} onClick={() => toggleInstrument(inst)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${selectedInstruments.includes(inst) ? 'bg-[#1c1c1e] text-white border-[#1c1c1e]' : 'bg-white border-[var(--border)] text-[var(--text-secondary)] hover:border-[#1c1c1e]'}`}>
                    {inst}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Автор переложения *</label>
              <div className="flex flex-col gap-2 mt-2">
                {[true, false].map(self => (
                  <label key={String(self)} className="flex items-center gap-2.5 cursor-pointer">
                    <div onClick={() => setArrangerSelf(self)}
                      className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${arrangerSelf === self ? 'border-[#1c1c1e] bg-[#1c1c1e]' : 'border-gray-300'}`}
                      style={{ width: 18, height: 18 }}>
                      {arrangerSelf === self && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="text-[13px]">{self ? 'Это моё переложение' : 'Другое авторство'}</span>
                  </label>
                ))}
              </div>
              {!arrangerSelf && (
                <input value={arrangerName} onChange={e => setArrangerName(e.target.value)} placeholder="Укажите имя аранжировщика"
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white/80 text-[14px] outline-none focus:border-[#1c1c1e] transition-colors" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Год переложения *</label>
                <input type="number" value={year} onChange={e => setYear(e.target.value)} min="1800" max="2099"
                  className="w-full mt-1.5 px-4 py-3 rounded-xl border border-[var(--border)] bg-white/80 text-[14px] outline-none focus:border-[#1c1c1e] transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Уровень сложности *</label>
                <div className="flex flex-col gap-1.5 mt-2">
                  {DIFFICULTY_LEVELS.map(d => (
                    <label key={d} className="flex items-center gap-2 cursor-pointer">
                      <div onClick={() => setDifficulty(d)}
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${difficulty === d ? 'border-[#1c1c1e] bg-[#1c1c1e]' : 'border-gray-300'}`}>
                        {difficulty === d && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-[12px] text-[#1c1c1e]">{d}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <h2 className="text-[18px] font-black text-[#1c1c1e]">Загрузка файлов</h2>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Партитура (полная версия) *</label>
              <input ref={scoreRef} type="file" accept=".pdf" className="hidden" onChange={e => setScoreFile(e.target.files?.[0] || null)} />
              <div
                onClick={() => scoreRef.current?.click()}
                className={`mt-2 flex items-center gap-3 px-5 py-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${scoreFile ? 'border-green-400 bg-green-50' : 'border-[var(--border)] hover:border-[#1c1c1e] bg-white/50'}`}
              >
                <span className="text-2xl">{scoreFile ? '✅' : '📄'}</span>
                <div>
                  <p className="font-semibold text-[13px] text-[#1c1c1e]">{scoreFile ? scoreFile.name : 'Выбрать PDF-файл'}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{scoreFile ? `${(scoreFile.size / 1024 / 1024).toFixed(2)} МБ` : 'PDF · до 50 МБ'}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Отдельные партии (необязательно)</label>
              <div className="flex flex-col gap-3 mt-2">
                {parts.map((part, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input value={part.instrument} onChange={e => updatePart(i, 'instrument', e.target.value)}
                      placeholder="Инструмент"
                      className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-[13px] outline-none focus:border-[#1c1c1e] transition-colors bg-white/80" />
                    <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-[12px] transition-all flex-shrink-0 ${part.file ? 'border-green-400 bg-green-50 text-green-700' : 'border-[var(--border)] hover:border-[#1c1c1e] text-[var(--text-secondary)] bg-white/50'}`}>
                      📎 {part.file ? part.file.name.slice(0, 12) + '…' : 'PDF'}
                      <input type="file" accept=".pdf" className="hidden" onChange={e => updatePart(i, 'file', e.target.files?.[0] || null)} />
                    </label>
                    <button onClick={() => removePart(i)} className="mt-2 text-gray-400 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                  </div>
                ))}
                <button onClick={addPart}
                  className="flex items-center gap-2 text-[13px] font-medium text-[var(--accent)] hover:opacity-80 transition-opacity w-fit">
                  <span className="text-lg">+</span> Добавить партию
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <h2 className="text-[18px] font-black text-[#1c1c1e]">Настройки и права</h2>

            <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-5">
              <p className="text-[13px] font-bold text-amber-800 mb-1">⚡ Защита через Сонатум</p>
              <ul className="text-[12px] text-amber-700 space-y-1.5 mt-2">
                <li>📋 Лицензионный договор-оферта фиксирует ваши права</li>
                <li>💧 Водяные знаки встраиваются при скачивании</li>
                <li>🏷 Метаданные автора встроены в файл</li>
                <li>⏱ Дата загрузки зафиксирована как первое опубликование</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { key: 'arranging', label: 'Я подтверждаю, что являюсь автором этого переложения или имею разрешение от правообладателя.', checked: confirmArranging, set: setConfirmArranging },
                { key: 'original', label: 'Оригинальное произведение находится в общественном достоянии или у меня есть разрешение от автора оригинала.', checked: confirmOriginal, set: setConfirmOriginal },
              ].map(c => (
                <label key={c.key} className="flex items-start gap-3 cursor-pointer group">
                  <div onClick={() => c.set(!c.checked)}
                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${c.checked ? 'bg-[#1c1c1e] border-[#1c1c1e]' : 'border-gray-300 group-hover:border-gray-500'}`}>
                    {c.checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                  </div>
                  <span className="text-[13px] text-[#1c1c1e] leading-relaxed">{c.label}</span>
                </label>
              ))}
            </div>

            <div className="bg-black/[0.03] rounded-2xl p-4 border border-[var(--border)]">
              <p className="text-[11px] text-[var(--text-secondary)] italic leading-relaxed">
                «Любое копирование, адаптация, аранжировка и/или передача этой охраняемой авторским правом музыки требует письменного согласия владельца авторских прав»
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-[var(--border)]">
          <div className="text-[11px] text-[var(--text-secondary)] self-center">
            {step === 1 && title && <span>📄 {title}</span>}
            {step === 2 && scoreFile && <span>✅ {scoreFile.name}</span>}
          </div>
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !canProceed1 : !canProceed2}
              className="px-8 py-3 rounded-full bg-[#1c1c1e] text-white text-[13px] font-bold disabled:opacity-30 hover:opacity-80 transition-opacity"
            >
              Продолжить →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed3 || submitting}
              className="px-8 py-3 rounded-full bg-[#1c1c1e] text-white text-[13px] font-bold disabled:opacity-30 hover:opacity-80 transition-opacity"
            >
              {submitting ? 'Отправка...' : 'Опубликовать ноты'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
