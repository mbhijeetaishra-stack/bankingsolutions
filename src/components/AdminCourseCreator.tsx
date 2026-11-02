'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ProPassPlan } from '@/lib/monetization';
import {
  DynamicCourse,
  DynamicCourseChapter,
  CourseCategory,
  DEFAULT_COURSE_PLANS,
  getDynamicCourses,
  syncDynamicCoursesFromSupabase,
  upsertDynamicCourse,
  deleteDynamicCourse,
  toggleDynamicCoursePublished,
  upsertCourseChapter,
  deleteCourseChapter,
} from '@/lib/courses';

const ICON_OPTIONS = ['🎓', '🏦', '📊', '🧠', '✍️', '💻', '🎯', '🔥', '📚', '⚡'];

export default function AdminCourseCreator() {
  const [subMode, setSubMode] = useState<'COURSES' | 'CHAPTERS'>('COURSES');
  const [courses, setCourses] = useState<DynamicCourse[]>([]);
  const [toast, setToast] = useState('');

  // Course Builder Form State
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CourseCategory>('GA_BANKING');
  const [icon, setIcon] = useState('🎓');
  const [badge, setBadge] = useState('NEW BATCH');
  const [isFree, setIsFree] = useState(false);
  const [includedInProPass, setIncludedInProPass] = useState(true);
  const [isPublished, setIsPublished] = useState(true);
  const [plans, setPlans] = useState<ProPassPlan[]>(DEFAULT_COURSE_PLANS);

  // Inline custom plan creator for Paid Course
  const [newPlanMonths, setNewPlanMonths] = useState<number>(3);
  const [newPlanOrig, setNewPlanOrig] = useState<number>(499);
  const [newPlanLaunch, setNewPlanLaunch] = useState<number>(249);
  const [newPlanBadge, setNewPlanBadge] = useState('POPULAR');

  // Chapter Builder Form State
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterNumber, setChapterNumber] = useState<number>(1);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterSubtitle, setChapterSubtitle] = useState('');
  const [markdownContent, setMarkdownContent] = useState('');
  const [hinglishContent, setHinglishContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isFreePreview, setIsFreePreview] = useState(true);

  useEffect(() => {
    const initial = getDynamicCourses();
    setCourses(initial);
    if (initial.length > 0) setSelectedCourseId(initial[0].id);

    syncDynamicCoursesFromSupabase().then((synced) => {
      setCourses(synced);
      if (synced.length > 0 && !selectedCourseId) {
        setSelectedCourseId(synced[0].id);
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const resetCourseForm = () => {
    setEditingCourseId(null);
    setTitle('');
    setSubtitle('');
    setDescription('');
    setCategory('GA_BANKING');
    setIcon('🎓');
    setBadge('NEW BATCH');
    setIsFree(false);
    setIncludedInProPass(true);
    setIsPublished(true);
    setPlans(DEFAULT_COURSE_PLANS);
  };

  const handleEditCourse = (c: DynamicCourse) => {
    setEditingCourseId(c.id);
    setTitle(c.title);
    setSubtitle(c.subtitle);
    setDescription(c.description);
    setCategory(c.category);
    setIcon(c.icon || '🎓');
    setBadge(c.badge || (c.isFree ? '100% FREE COURSE' : 'PREMIUM COURSE'));
    setIsFree(c.isFree);
    setIncludedInProPass(c.includedInProPass);
    setIsPublished(c.isPublished);
    setPlans(c.plans && c.plans.length > 0 ? c.plans : DEFAULT_COURSE_PLANS);
    setSubMode('COURSES');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdatePlanField = (
    idx: number,
    field: keyof ProPassPlan,
    val: any
  ) => {
    const copy = [...plans];
    copy[idx] = { ...copy[idx], [field]: val };
    setPlans(copy);
  };

  const handleAddDurationTier = () => {
    if (newPlanMonths <= 0) return;
    const tier: ProPassPlan = {
      id: `cplan_${Date.now()}`,
      title: `${newPlanMonths} ${newPlanMonths === 1 ? 'Month' : 'Months'} Access`,
      durationMonths: Number(newPlanMonths),
      originalPrice: Number(newPlanOrig),
      launchPrice: Number(newPlanLaunch),
      badge: newPlanBadge.trim().toUpperCase(),
      isPopular: false,
      isActive: true,
    };
    const filtered = plans.filter((p) => p.durationMonths !== Number(newPlanMonths));
    const next = [...filtered, tier].sort((a, b) => a.durationMonths - b.durationMonths);
    setPlans(next);
    showToast(`✓ Added ${newPlanMonths}M duration plan`);
  };

  const handleRemoveDurationTier = (id: string) => {
    if (plans.length <= 1) {
      showToast('⚠️ A paid course must have at least 1 duration plan.');
      return;
    }
    setPlans(plans.filter((p) => p.id !== id));
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const existingCourse = courses.find((c) => c.id === editingCourseId);
    const updated = await upsertDynamicCourse({
      id: editingCourseId || undefined,
      title: title.trim(),
      subtitle: subtitle.trim() || 'Complete Banking Exam Mastery Series',
      description:
        description.trim() ||
        'Structured bilingual chapters, shortcut formulas, video lectures, and practice PDFs.',
      category,
      icon,
      badge: badge.trim().toUpperCase() || (isFree ? '100% FREE COURSE' : 'PREMIUM COURSE'),
      isFree,
      includedInProPass,
      isPublished,
      plans: isFree ? [] : plans,
      chapters: existingCourse ? existingCourse.chapters : [],
    });

    setCourses(updated);
    if (!selectedCourseId && updated.length > 0) {
      setSelectedCourseId(updated[0].id);
    }
    showToast(
      editingCourseId
        ? `✓ Updated course "${title.trim()}"!`
        : `🎉 Created ${isFree ? 'FREE' : 'PAID'} course "${title.trim()}"!`
    );
    resetCourseForm();
  };

  const handleTogglePublish = async (id: string) => {
    const updated = await toggleDynamicCoursePublished(id);
    setCourses(updated);
    showToast('✓ Updated course visibility on website');
  };

  const handleDeleteCourseClick = async (id: string, name: string) => {
    if (!confirm(`Delete course "${name}" and all its chapters?`)) return;
    const updated = await deleteDynamicCourse(id);
    setCourses(updated);
    showToast(`🗑️ Deleted course "${name}"`);
  };

  // --- CHAPTER MANAGEMENT HANDLERS ---
  const activeCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

  const resetChapterForm = (nextNo?: number) => {
    setEditingChapterId(null);
    setChapterNumber(
      nextNo ?? ((activeCourse?.chapters?.length || 0) + 1)
    );
    setChapterTitle('');
    setChapterSubtitle('');
    setMarkdownContent('');
    setHinglishContent('');
    setVideoUrl('');
    setPdfUrl('');
    setPdfFile(null);
    setIsFreePreview(activeCourse?.isFree ? true : false);
  };

  const handleEditChapterClick = (ch: DynamicCourseChapter) => {
    setEditingChapterId(ch.id);
    setChapterNumber(ch.chapterNumber);
    setChapterTitle(ch.title);
    setChapterSubtitle(ch.subtitle || '');
    setMarkdownContent(ch.markdownContent);
    setHinglishContent(ch.hinglishContent || '');
    setVideoUrl(ch.videoUrl || '');
    setPdfUrl(ch.pdfUrl || '');
    setPdfFile(null);
    setIsFreePreview(ch.isFreePreview);
  };

  const handleSaveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !chapterTitle.trim()) return;

    let finalPdfUrl = pdfUrl.trim();
    if (pdfFile) {
      setIsUploadingPdf(true);
      try {
        const cleanName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `dynamic_courses/${activeCourse.slug}/ch${chapterNumber}_${Date.now()}_${cleanName}`;
        const { error: upErr } = await supabase.storage
          .from('course_pdfs')
          .upload(path, pdfFile, { upsert: true });

        if (!upErr) {
          const { data: pub } = supabase.storage
            .from('course_pdfs')
            .getPublicUrl(path);
          finalPdfUrl = pub.publicUrl;
        }
      } catch (err) {
        console.error('PDF upload error:', err);
      }
      setIsUploadingPdf(false);
    }

    const updated = await upsertCourseChapter(activeCourse.id, {
      id: editingChapterId || undefined,
      chapterNumber: Number(chapterNumber),
      title: chapterTitle.trim(),
      subtitle: chapterSubtitle.trim() || undefined,
      markdownContent:
        markdownContent.trim() || `# ${chapterTitle.trim()}\n\nStudy notes for this chapter.`,
      hinglishContent: hinglishContent.trim() || undefined,
      videoUrl: videoUrl.trim() || undefined,
      pdfUrl: finalPdfUrl || undefined,
      isFreePreview: activeCourse.isFree ? true : isFreePreview,
    });

    setCourses(updated);
    const refreshedCourse = updated.find((c) => c.id === activeCourse.id);
    resetChapterForm((refreshedCourse?.chapters?.length || 0) + 1);
    showToast(`✓ Saved Chapter ${chapterNumber}: "${chapterTitle.trim()}"!`);
  };

  const handleDeleteChapterClick = async (chId: string, chTitle: string) => {
    if (!activeCourse) return;
    if (!confirm(`Delete chapter "${chTitle}"?`)) return;
    const updated = await deleteCourseChapter(activeCourse.id, chId);
    setCourses(updated);
    showToast('🗑️ Deleted chapter');
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-xl">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
            Universal Course Studio (Free &amp; Paid Courses)
          </span>
          <h2 className="text-xl font-black text-white mt-0.5">
            🎓 Create &amp; Manage Any Course (Free or Paid)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Launch unlimited Free or Paid courses with 1M/3M/6M/12M plans, Bilingual Markdown chapters, YouTube lectures, and PDF downloads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/courses"
            target="_blank"
            className="px-4 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-amber-400/35 text-amber-300 font-black text-xs transition flex items-center gap-1.5"
          >
            <span>🌐</span>
            <span>Open Live Courses Page ↗</span>
          </Link>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setSubMode('COURSES')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                subMode === 'COURSES'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎓 1. Create / Edit Courses ({courses.length})
            </button>
            <button
              type="button"
              onClick={() => setSubMode('CHAPTERS')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                subMode === 'CHAPTERS'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📖 2. Course Chapters &amp; Notes
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          {toast}
        </div>
      )}

      {subMode === 'COURSES' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: CREATE / EDIT COURSE FORM */}
          <form
            onSubmit={handleSaveCourse}
            className="lg:col-span-6 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-5 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {editingCourseId ? '✏️ Edit Course Configuration' : '➕ Create New Course (Free or Paid)'}
              </h3>
              {editingCourseId && (
                <button
                  type="button"
                  onClick={resetCourseForm}
                  className="text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Pricing Mode Switcher: FREE vs PAID */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                Course Access Type (Free vs Paid):
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsFree(true);
                    setBadge('100% FREE COURSE');
                  }}
                  className={`py-3 px-4 rounded-2xl border text-left transition flex items-center gap-3 ${
                    isFree
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-lg'
                      : 'bg-slate-950 border-white/[0.08] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xl">🎁</span>
                  <div>
                    <div className="text-xs font-black">FREE Course</div>
                    <div className="text-[10px] opacity-80">₹0 • Open to all students</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsFree(false);
                    if (badge === '100% FREE COURSE') setBadge('PREMIUM BATCH');
                  }}
                  className={`py-3 px-4 rounded-2xl border text-left transition flex items-center gap-3 ${
                    !isFree
                      ? 'bg-amber-400/15 border-amber-400 text-amber-300 shadow-lg'
                      : 'bg-slate-950 border-white/[0.08] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xl">💳</span>
                  <div>
                    <div className="text-xs font-black">PAID Course</div>
                    <div className="text-[10px] opacity-80">1M / 3M / 6M / 12M Plans</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Course Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. High-Level DI & Arithmetic Mains Batch"
                  required
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Subject Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CourseCategory)}
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                >
                  <option value="GA_BANKING">🏦 Banking &amp; GA</option>
                  <option value="QUANT">📊 Quantitative Aptitude &amp; DI</option>
                  <option value="REASONING">🧠 Reasoning &amp; Puzzles</option>
                  <option value="ENGLISH">✍️ English &amp; Descriptive</option>
                  <option value="COMPUTER">💻 Computer Awareness</option>
                  <option value="DESCRIPTIVE">📝 Descriptive Writing</option>
                  <option value="COMBO">🔥 All-In-One Combo Batch</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Target Exams / Subtitle
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. SBI PO, IBPS PO & RRB Mains 2026"
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Top Highlight Badge
                </label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="e.g. 100% FREE COURSE or MAINS SPECIAL"
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-bold text-amber-300 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Icon Selector */}
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1.5">
                Choose Course Icon:
              </label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`w-9 h-9 rounded-xl text-base flex items-center justify-center border transition ${
                      icon === ic
                        ? 'bg-amber-400/20 border-amber-400 scale-110'
                        : 'bg-slate-950 border-white/[0.08] hover:border-white/25'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Course Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will students learn in this course?"
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>

            {/* IF PAID COURSE: MULTI-DURATION PLANS CONFIGURATOR */}
            {!isFree && (
              <div className="bg-slate-950/90 border border-amber-400/30 rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                  <div>
                    <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      ⏳ Paid Course Duration Plans (1M / 3M / 6M / 12M)
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Edit prices below or add custom month durations for this course. Promo codes (up to 100% OFF) work automatically!
                    </p>
                  </div>
                </div>

                {/* Editable Existing Tiers */}
                <div className="space-y-2">
                  {plans.map((p, idx) => (
                    <div
                      key={p.id}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-900 border border-white/[0.06] p-2.5 rounded-xl text-xs"
                    >
                      <div className="col-span-3">
                        <span className="text-[10px] text-slate-400 block">Months</span>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={p.durationMonths}
                          onChange={(e) =>
                            handleUpdatePlanField(idx, 'durationMonths', Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-white/[0.1] rounded-lg px-2 py-1 text-xs font-black text-white"
                        />
                      </div>
                      <div className="col-span-4">
                        <span className="text-[10px] text-slate-400 block">MRP (₹)</span>
                        <input
                          type="number"
                          min={0}
                          value={p.originalPrice}
                          onChange={(e) =>
                            handleUpdatePlanField(idx, 'originalPrice', Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-slate-300"
                        />
                      </div>
                      <div className="col-span-4">
                        <span className="text-[10px] text-amber-300 font-bold block">Sale (₹)</span>
                        <input
                          type="number"
                          min={0}
                          value={p.launchPrice}
                          onChange={(e) =>
                            handleUpdatePlanField(idx, 'launchPrice', Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-amber-400/30 rounded-lg px-2 py-1 text-xs font-black text-amber-400"
                        />
                      </div>
                      <div className="col-span-1 text-right pt-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveDurationTier(p.id)}
                          className="text-rose-400 hover:text-rose-300 font-bold text-xs"
                          title="Remove duration"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Custom Month Plan Row */}
                <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-end gap-2">
                  <div className="w-20">
                    <span className="text-[10px] text-slate-400 block mb-1">+ Months</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={newPlanMonths}
                      onChange={(e) => setNewPlanMonths(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                    />
                  </div>
                  <div className="w-24">
                    <span className="text-[10px] text-slate-400 block mb-1">MRP (₹)</span>
                    <input
                      type="number"
                      min={0}
                      value={newPlanOrig}
                      onChange={(e) => setNewPlanOrig(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="w-24">
                    <span className="text-[10px] text-slate-400 block mb-1">Sale (₹)</span>
                    <input
                      type="number"
                      min={0}
                      value={newPlanLaunch}
                      onChange={(e) => setNewPlanLaunch(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs font-black text-amber-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDurationTier}
                    className="px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 font-black text-xs transition"
                  >
                    + Add Plan
                  </button>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer pt-1 select-none">
                  <input
                    type="checkbox"
                    checked={includedInProPass}
                    onChange={(e) => setIncludedInProPass(e.target.checked)}
                    className="w-4 h-4 accent-amber-400 rounded"
                  />
                  <span className="text-xs font-bold text-slate-200">
                    👑 Automatically unlock this course for <strong className="text-amber-300">PRO Pass</strong> holders
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition cursor-pointer"
            >
              {editingCourseId
                ? 'Save Course Changes →'
                : isFree
                ? '🎁 Publish FREE Course Now →'
                : '💳 Publish PAID Course Now →'}
            </button>
          </form>

          {/* RIGHT: EXISTING COURSES LIST */}
          <div className="lg:col-span-6 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Published &amp; Draft Courses ({courses.length})
              </h3>
              <span className="text-xs text-slate-400">
                Click &ldquo;📖 Manage Chapters&rdquo; to add study notes &amp; PDFs
              </span>
            </div>

            <div className="space-y-4">
              {courses.map((course) => {
                const lowestPlan =
                  course.plans && course.plans.length > 0
                    ? [...course.plans].sort((a, b) => a.launchPrice - b.launchPrice)[0]
                    : null;

                return (
                  <div
                    key={course.id}
                    className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-5 space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-2xl shrink-0">
                          {course.icon || '🎓'}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                course.isFree
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-400 text-slate-950'
                              }`}
                            >
                              {course.isFree
                                ? '🎁 FREE COURSE'
                                : `💳 PAID (From ₹${lowestPlan?.launchPrice || 149})`}
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-300">
                              {course.chapters.length} Chapters
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                course.isPublished
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {course.isPublished ? '● Live' : '○ Hidden'}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-white mt-1">
                            {course.title}
                          </h4>
                          <p className="text-xs text-slate-400">{course.subtitle}</p>
                        </div>
                      </div>
                    </div>

                    {!course.isFree && course.plans && course.plans.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {course.plans.map((pl) => (
                          <span
                            key={pl.id}
                            className="text-[10px] font-bold bg-slate-900 border border-white/[0.06] px-2.5 py-1 rounded-lg text-slate-300"
                          >
                            {pl.durationMonths}M: <strong className="text-amber-400">₹{pl.launchPrice}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          setSubMode('CHAPTERS');
                          resetChapterForm((course.chapters?.length || 0) + 1);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition"
                      >
                        📖 Manage Chapters ({course.chapters.length})
                      </button>

                      <Link
                        href={`/courses/${course.slug}`}
                        target="_blank"
                        className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-blue-300 font-bold text-xs transition"
                      >
                        🔗 View Page ↗
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleEditCourse(course)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                      >
                        ✏️ Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTogglePublish(course.id)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                      >
                        {course.isPublished ? 'Hide' : 'Publish'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCourseClick(course.id, course.title)}
                        className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-xs transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ==================== STEP 2: COURSE CHAPTERS & CONTENT BUILDER ==================== */
        <div className="space-y-6">
          {/* Course Selector Bar */}
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-black uppercase text-amber-400 shrink-0">
                Select Course:
              </span>
              <select
                value={activeCourse?.id || ''}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  const found = courses.find((c) => c.id === e.target.value);
                  resetChapterForm((found?.chapters?.length || 0) + 1);
                }}
                className="bg-slate-950 border border-white/[0.12] rounded-xl px-4 py-2.5 text-xs font-black text-white outline-none focus:border-amber-400 w-full sm:w-96"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.title} ({c.isFree ? 'FREE' : 'PAID'})
                  </option>
                ))}
              </select>
            </div>

            {activeCourse && (
              <Link
                href={`/courses/${activeCourse.slug}`}
                target="_blank"
                className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/35 text-blue-300 font-black text-xs hover:bg-blue-600/30 transition"
              >
                🔗 Preview &ldquo;{activeCourse.title}&rdquo; Live ↗
              </Link>
            )}
          </div>

          {activeCourse && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Add / Edit Chapter Form */}
              <form
                onSubmit={handleSaveChapter}
                className="lg:col-span-7 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {editingChapterId
                      ? `✏️ Edit Chapter ${chapterNumber}`
                      : `➕ Add Chapter to "${activeCourse.title}"`}
                  </h3>
                  {editingChapterId && (
                    <button
                      type="button"
                      onClick={() => resetChapterForm((activeCourse.chapters?.length || 0) + 1)}
                      className="text-xs font-bold text-slate-400 hover:text-white"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                      Chapter No.
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={chapterNumber}
                      onChange={(e) => setChapterNumber(Number(e.target.value))}
                      required
                      className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-black text-amber-400 outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                      Chapter Title *
                    </label>
                    <input
                      type="text"
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      placeholder="e.g. RBI Monetary Policy & Repo Rate Shortcuts"
                      required
                      className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                      Topic Subtitle (Optional)
                    </label>
                    <input
                      type="text"
                      value={chapterSubtitle}
                      onChange={(e) => setChapterSubtitle(e.target.value)}
                      placeholder="e.g. High-Weightage Mains Concepts + 25 MCQs"
                      className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                      YouTube / Video Lecture Link (Optional)
                    </label>
                    <input
                      type="text"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* PDF Upload or Direct URL */}
                <div className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 space-y-3">
                  <label className="text-[11px] font-bold uppercase text-amber-300 block">
                    📄 Attach Chapter Practice PDF (Upload File or Paste Link):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      className="text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-amber-400 file:text-slate-950 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={pdfUrl}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      placeholder="Or paste direct PDF URL..."
                      className="w-full bg-slate-900 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* English Markdown Content */}
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                    🇬🇧 English Study Notes (Supports Markdown Tables, Headings &amp; Lists)
                  </label>
                  <textarea
                    rows={7}
                    value={markdownContent}
                    onChange={(e) => setMarkdownContent(e.target.value)}
                    placeholder="Write chapter notes, formulas, tables, or practice questions here..."
                    className="w-full bg-slate-950 border border-white/[0.1] rounded-2xl p-3.5 text-xs font-mono text-white outline-none focus:border-amber-400"
                  />
                </div>

                {/* Hinglish Markdown Content */}
                <div>
                  <label className="text-[11px] font-bold uppercase text-amber-400/90 block mb-1">
                    🇮🇳 Hinglish Study Notes (Optional — Enables 🇬🇧 English / 🇮🇳 Hinglish Switcher)
                  </label>
                  <textarea
                    rows={5}
                    value={hinglishContent}
                    onChange={(e) => setHinglishContent(e.target.value)}
                    placeholder="Optional Hinglish explanation for students who prefer Hinglish..."
                    className="w-full bg-slate-950 border border-white/[0.1] rounded-2xl p-3.5 text-xs font-mono text-white outline-none focus:border-amber-400"
                  />
                </div>

                {!activeCourse.isFree && (
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isFreePreview}
                      onChange={(e) => setIsFreePreview(e.target.checked)}
                      className="w-4 h-4 accent-emerald-400 rounded"
                    />
                    <span className="text-xs font-bold text-emerald-300">
                      🔓 Unlock this chapter as a Free Demo Preview (Unchecked = Locked behind Paid Course Checkout)
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={isUploadingPdf}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition cursor-pointer"
                >
                  {isUploadingPdf
                    ? 'Uploading PDF & Saving Chapter...'
                    : editingChapterId
                    ? 'Update Chapter →'
                    : 'Save Chapter to Course →'}
                </button>
              </form>

              {/* Right: Chapter List for Active Course */}
              <div className="lg:col-span-5 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
                <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/[0.08] pb-3">
                  Chapters in &ldquo;{activeCourse.title}&rdquo; ({activeCourse.chapters.length})
                </h3>

                {activeCourse.chapters.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    No chapters added yet. Use the form on the left to add Chapter 1!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeCourse.chapters.map((ch) => (
                      <div
                        key={ch.id}
                        className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400/15 text-amber-300">
                              Ch {ch.chapterNumber}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                activeCourse.isFree || ch.isFreePreview
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-rose-500/15 text-rose-300'
                              }`}
                            >
                              {activeCourse.isFree || ch.isFreePreview
                                ? '🔓 Free Access'
                                : '🔒 Paid Locked'}
                            </span>
                            {ch.videoUrl && (
                              <span className="text-[10px] font-bold text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded">
                                🎥 Video
                              </span>
                            )}
                            {ch.pdfUrl && (
                              <span className="text-[10px] font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded">
                                📄 PDF
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs sm:text-sm font-black text-white">
                            {ch.title}
                          </h4>
                          {ch.subtitle && (
                            <p className="text-[11px] text-slate-400">{ch.subtitle}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditChapterClick(ch)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChapterClick(ch.id, ch.title)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-xs transition"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
