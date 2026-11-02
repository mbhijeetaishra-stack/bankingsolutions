'use client';

import React, { useEffect, useState } from 'react';
import {
  DEFAULT_DAILY_MISSION_TASKS,
  DailyMissionTask,
  MissionCategory,
  getMissionTasks,
  saveMissionTasks,
  syncDailyMissionFromSupabase,
} from '@/lib/dailyMission';

export default function AdminDailyMissionManager() {
  const [tasks, setTasks] = useState<DailyMissionTask[]>([]);
  const [statusMsg, setStatusMsg] = useState('');

  // Form states for new/editing task
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<MissionCategory>('QUANT');
  const [xp, setXp] = useState<number>(50);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(15);
  const [actionUrl, setActionUrl] = useState('/tests');
  const [actionLabel, setActionLabel] = useState('Start Now');

  useEffect(() => {
    setTasks(getMissionTasks());
    syncDailyMissionFromSupabase().then(({ tasks: synced }) => {
      setTasks(synced);
    });
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setCategory('QUANT');
    setXp(50);
    setEstimatedMinutes(15);
    setActionUrl('/tests');
    setActionLabel('Start Now');
  };

  const handleEdit = (t: DailyMissionTask) => {
    setEditingId(t.id);
    setTitle(t.title);
    setSubtitle(t.subtitle);
    setCategory(t.category);
    setXp(t.xp);
    setEstimatedMinutes(t.estimatedMinutes);
    setActionUrl(t.actionUrl);
    setActionLabel(t.actionLabel);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const record: DailyMissionTask = {
      id: editingId || `mission_${Date.now()}`,
      title: title.trim(),
      subtitle: subtitle.trim() || 'Complete this daily study target to earn XP & protect your streak',
      category,
      xp: Math.max(5, Number(xp) || 50),
      estimatedMinutes: Math.max(5, Number(estimatedMinutes) || 15),
      actionUrl: actionUrl.trim() || '/tests',
      actionLabel: actionLabel.trim() || 'Start Now',
    };

    const updated = editingId
      ? tasks.map((item) => (item.id === editingId ? record : item))
      : [...tasks, record];

    setTasks(updated);
    await saveMissionTasks(updated);
    setStatusMsg(
      editingId
        ? '✅ Updated Daily Mission task & synced to all students!'
        : '✅ Added new Daily Mission task & synced to all students!'
    );
    resetForm();
  };

  const handleDeleteTask = async (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    await saveMissionTasks(updated);
    setStatusMsg('🗑️ Removed Daily Mission task.');
  };

  const handleRestoreDefaults = async () => {
    setTasks(DEFAULT_DAILY_MISSION_TASKS);
    await saveMissionTasks(DEFAULT_DAILY_MISSION_TASKS);
    setStatusMsg('🔄 Restored default 6 Banking Daily Mission tasks!');
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 block">
            Student Retention &amp; Streak Engine
          </span>
          <h2 className="text-xl font-black text-white mt-0.5">
            🔥 Daily Study Mission &amp; XP Checklist Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Customize the daily study checklist shown on the Homepage and Student Dashboard. Changes sync live to all students.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRestoreDefaults}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
        >
          🔄 Restore Default 6 Missions
        </button>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Add / Edit Form */}
        <form
          onSubmit={handleSaveTask}
          className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 h-fit"
        >
          <h3 className="text-sm font-black text-white">
            {editingId ? '✏️ Edit Daily Mission Task' : '➕ Add New Daily Mission Task'}
          </h3>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 15-Min Speed Math Drill in Calc Lab"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Subtitle / Instructions
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g., Solve 20 approximations & number series"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MissionCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
              >
                <option value="QUANT">⚡ QUANT</option>
                <option value="GA">📰 GA / CA</option>
                <option value="MOCK">🚀 MOCK TEST</option>
                <option value="REASONING">🧠 REASONING</option>
                <option value="ENGLISH">📖 ENGLISH</option>
                <option value="REVISION">🔖 REVISION</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                XP Reward
              </label>
              <input
                type="number"
                min={5}
                max={500}
                value={xp}
                onChange={(e) => setXp(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-amber-300 font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Est. Minutes
              </label>
              <input
                type="number"
                min={5}
                max={180}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Target Page URL
              </label>
              <input
                type="text"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="/calc-lab or /tests"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Button Label
              </label>
              <input
                type="text"
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                placeholder="Open Calc Lab"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition"
            >
              {editingId ? '💾 Update Mission Task' : '➕ Add to Daily Checklist'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Right: Active Daily Mission Tasks List */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">
              Active Daily Checklist ({tasks.length} Tasks • Total{' '}
              {tasks.reduce((s, t) => s + t.xp, 0)} XP/day)
            </h3>
          </div>

          <div className="space-y-2.5">
            {tasks.map((task, idx) => (
              <div
                key={task.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      #{idx + 1} • {task.category}
                    </span>
                    <span className="text-[10px] font-black bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded">
                      +{task.xp} XP
                    </span>
                    <span className="text-[10px] text-slate-400">⏱ {task.estimatedMinutes} min</span>
                    <span className="text-[10px] text-blue-400 font-mono">{task.actionUrl}</span>
                  </div>
                  <div className="text-xs font-bold text-white">{task.title}</div>
                  <div className="text-[11px] text-slate-400">{task.subtitle}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEdit(task)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-lg"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-bold rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

