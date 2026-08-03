'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import * as XLSX from 'xlsx';

interface QuizContainer {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
}

export default function AdminComputerQuizPage() {
  const [activeTab, setActiveTab] = useState<'create_container' | 'bulk_upload' | 'add_question'>('create_container');
  const [containers, setContainers] = useState<QuizContainer[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 1. Container Form States
  const [containerId, setContainerId] = useState('');
  const [containerTitle, setContainerTitle] = useState('');
  const [containerDesc, setContainerDesc] = useState('');
  const [containerCategory, setContainerCategory] = useState('Full Mock');
  const [containerDifficulty, setContainerDifficulty] = useState('Moderate');

  // 2. Question Form States
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [opt0, setOpt0] = useState('');
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');
  const [opt3, setOpt3] = useState('');
  const [correctOption, setCorrectOption] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [qCategory, setQCategory] = useState('General Computer');

  // 3. Bulk Upload States
  const [excelFile, setExcelFile] = useState<File | null>(null);

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    const { data, error } = await supabase
      .from('computer_quiz_containers')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setContainers(data as QuizContainer[]);
      if (data.length > 0 && !selectedQuizId) {
        setSelectedQuizId(data[0].id);
      }
    }
  };

  // Create Quiz Container
  const handleCreateContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    const formattedId = containerId.trim().toLowerCase().replace(/\s+/g, '_');

    const { error } = await supabase.from('computer_quiz_containers').insert([
      {
        id: formattedId,
        title: containerTitle,
        description: containerDesc,
        category: containerCategory,
        difficulty: containerDifficulty,
      },
    ]);

    if (error) {
      setMsg(`❌ Error: ${error.message}`);
    } else {
      setMsg(`✅ Quiz Container "${containerTitle}" Created Successfully!`);
      setContainerId('');
      setContainerTitle('');
      setContainerDesc('');
      fetchContainers();
      setActiveTab('bulk_upload');
      setSelectedQuizId(formattedId);
    }
    setLoading(false);
  };

  // Delete Quiz Container & All Its Questions
  const handleDeleteContainer = async (id: string, title: string) => {
    const confirmDelete = confirm(
      `⚠️ Are you sure you want to delete "${title}" (${id})?\n\nThis will also permanently delete ALL questions inside this quiz.`
    );

    if (!confirmDelete) return;

    setLoading(true);
    setMsg('⏳ Deleting quiz container and associated questions...');

    // 1. Delete associated questions first
    const { error: qError } = await supabase
      .from('computer_quiz_questions')
      .delete()
      .eq('quiz_id', id);

    if (qError) {
      setMsg(`❌ Error deleting questions: ${qError.message}`);
      setLoading(false);
      return;
    }

    // 2. Delete the container itself
    const { error: cError } = await supabase
      .from('computer_quiz_containers')
      .delete()
      .eq('id', id);

    if (cError) {
      setMsg(`❌ Error deleting container: ${cError.message}`);
    } else {
      setMsg(`🗑️ Quiz Container "${title}" deleted successfully!`);
      fetchContainers();
    }
    setLoading(false);
  };

  // Add Single Question
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    if (!selectedQuizId) {
      setMsg('❌ Please select a Quiz Container first!');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('computer_quiz_questions').insert([
      {
        quiz_id: selectedQuizId,
        question: questionText,
        options: [opt0, opt1, opt2, opt3],
        correct_option: Number(correctOption),
        explanation,
        category: qCategory,
      },
    ]);

    if (error) {
      setMsg(`❌ Error: ${error.message}`);
    } else {
      setMsg(`✅ Question added to "${selectedQuizId.toUpperCase()}"!`);
      setQuestionText('');
      setOpt0('');
      setOpt1('');
      setOpt2('');
      setOpt3('');
      setExplanation('');
    }
    setLoading(false);
  };

  // Bulk Excel Upload
  const handleBulkExcelUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) {
      setMsg('❌ Please select an Excel (.xlsx or .csv) file first!');
      return;
    }
    if (!selectedQuizId) {
      setMsg('❌ Please select a target Quiz Container!');
      return;
    }

    setLoading(true);
    setMsg('⏳ Processing Excel file...');

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          setMsg('❌ Excel sheet is empty!');
          setLoading(false);
          return;
        }

        const formattedQuestions = rawData.map((row) => ({
          quiz_id: selectedQuizId,
          question: row.question || row.Question,
          options: [
            row.option_a || row['Option A'] || '',
            row.option_b || row['Option B'] || '',
            row.option_c || row['Option C'] || '',
            row.option_d || row['Option D'] || '',
          ],
          correct_option: Number(
            row.correct_option_index !== undefined
              ? row.correct_option_index
              : row.correct_option || 0
          ),
          explanation: row.explanation || row.Explanation || '',
          category: row.category || row.Category || 'General Computer',
        }));

        const { error } = await supabase
          .from('computer_quiz_questions')
          .insert(formattedQuestions);

        if (error) {
          setMsg(`❌ Upload Error: ${error.message}`);
        } else {
          setMsg(`🎉 Successfully uploaded ${formattedQuestions.length} questions to ${selectedQuizId.toUpperCase()}!`);
          setExcelFile(null);
        }
      } catch (err: any) {
        setMsg(`❌ File Parsing Error: ${err.message}`);
      }
      setLoading(false);
    };

    reader.readAsBinaryString(excelFile);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-black text-amber-400">⚡ Computer Quiz Admin Portal</h1>
            <p className="text-xs text-slate-400">Manage Containers, Questions & Excel Uploads</p>
          </div>
          <Link
            href="/computer-quiz"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl border border-slate-700 transition"
          >
            👁️ View Student Cards
          </Link>
        </div>

        {/* FEEDBACK MSG */}
        {msg && (
          <div className="p-3 bg-slate-900 border border-slate-700 text-xs font-bold text-amber-300 rounded-xl">
            {msg}
          </div>
        )}

        {/* TABS SWITCHER */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => {
              setActiveTab('create_container');
              setMsg('');
            }}
            className={`flex-1 py-2.5 rounded-xl transition ${
              activeTab === 'create_container' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📦 1. Create Container
          </button>
          <button
            onClick={() => {
              setActiveTab('bulk_upload');
              setMsg('');
            }}
            className={`flex-1 py-2.5 rounded-xl transition ${
              activeTab === 'bulk_upload' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 2. Bulk Excel Upload
          </button>
          <button
            onClick={() => {
              setActiveTab('add_question');
              setMsg('');
            }}
            className={`flex-1 py-2.5 rounded-xl transition ${
              activeTab === 'add_question' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            ➕ 3. Single Add
          </button>
        </div>

        {/* TAB 1: CREATE CONTAINER & EXISTING CONTAINERS LIST */}
        {activeTab === 'create_container' && (
          <div className="space-y-6">
            {/* CREATE CONTAINER FORM */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Define New Quiz Container</h2>
              
              <form onSubmit={handleCreateContainer} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Container Unique ID</label>
                    <input
                      type="text"
                      required
                      value={containerId}
                      onChange={(e) => setContainerId(e.target.value)}
                      placeholder="e.g. quiz_2, quiz_3"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Quiz Display Title</label>
                    <input
                      type="text"
                      required
                      value={containerTitle}
                      onChange={(e) => setContainerTitle(e.target.value)}
                      placeholder="e.g. Computer Quiz 2"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Short Description</label>
                  <textarea
                    required
                    rows={2}
                    value={containerDesc}
                    onChange={(e) => setContainerDesc(e.target.value)}
                    placeholder="e.g. Networking, Internet Protocols & Cyber Security Special"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Category Badge</label>
                    <input
                      type="text"
                      required
                      value={containerCategory}
                      onChange={(e) => setContainerCategory(e.target.value)}
                      placeholder="e.g. Full Mock, Networking, DBMS"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Difficulty</label>
                    <select
                      value={containerDifficulty}
                      onChange={(e) => setContainerDifficulty(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-amber-400"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-amber-400 text-slate-950 font-black rounded-xl hover:bg-amber-300 uppercase tracking-wider transition"
                >
                  {loading ? 'Creating...' : 'Create Quiz Container →'}
                </button>
              </form>
            </div>

            {/* EXISTING CONTAINERS MANAGER LIST */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex justify-between items-center">
                <span>📦 Existing Quiz Containers ({containers.length})</span>
              </h3>

              {containers.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">No quiz containers created yet.</div>
              ) : (
                <div className="space-y-3">
                  {containers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-sm">{c.title}</span>
                          <span className="bg-slate-800 text-amber-400 border border-slate-700 px-2 py-0.5 rounded font-mono text-[10px]">
                            {c.id}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5">{c.description}</p>
                      </div>

                      {/* DELETE BUTTON */}
                      <button
                        onClick={() => handleDeleteContainer(c.id, c.title)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-rose-400 font-bold text-[11px] rounded-lg transition"
                      >
                        🗑️ Delete Quiz
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: BULK EXCEL UPLOAD */}
        {activeTab === 'bulk_upload' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Bulk Upload via Excel (.xlsx / .csv)</h2>
              <p className="text-xs text-slate-400 mt-1">Upload 40+ questions at once directly into any Quiz Container.</p>
            </div>

            <form onSubmit={handleBulkExcelUpload} className="space-y-4 text-xs">
              <div>
                <label className="block text-amber-400 mb-1 font-bold uppercase">Select Target Quiz Container</label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="w-full bg-slate-950 border border-amber-400/50 rounded-xl p-3 text-white font-bold outline-none"
                >
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.id}) — [{c.category}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-2xl p-8 text-center bg-slate-950 cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="excel-input"
                />
                <label htmlFor="excel-input" className="cursor-pointer space-y-2 block">
                  <div className="text-3xl">📊</div>
                  <span className="font-bold text-white block">
                    {excelFile ? excelFile.name : 'Click to Choose Excel (.xlsx) File'}
                  </span>
                </label>
              </div>
                  {/* FORMAT GUIDANCE */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-[11px] space-y-1 text-slate-400">
                <span className="font-bold text-amber-400 block uppercase">Required Excel Column Names:</span>
                <p>
                  <code className="text-slate-200 font-mono">question</code> | <code className="text-slate-200 font-mono">option_a</code> | <code className="text-slate-200 font-mono">option_b</code> | <code className="text-slate-200 font-mono">option_c</code> | <code className="text-slate-200 font-mono">option_d</code> | <code className="text-slate-200 font-mono">correct_option_index</code> (0-3) | <code className="text-slate-200 font-mono">explanation</code> | <code className="text-slate-200 font-mono">category</code>
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || !excelFile}
                className="w-full py-3.5 bg-amber-400 text-slate-950 font-black rounded-xl hover:bg-amber-300 uppercase tracking-wider transition disabled:opacity-50"
              >
                {loading ? 'Uploading Questions...' : 'Upload Excel Questions →'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: SINGLE QUESTION ADD */}
        {activeTab === 'add_question' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Add Single Question</h2>

            <form onSubmit={handleAddQuestion} className="space-y-4 text-xs">
              <div>
                <label className="block text-amber-400 mb-1 font-bold uppercase">Select Target Quiz Container</label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="w-full bg-slate-950 border border-amber-400/50 rounded-xl p-3 text-white font-bold outline-none"
                >
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.id}) — [{c.category}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Question Prompt</label>
                <textarea
                  required
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="e.g. Which layer of the OSI model is responsible for routing data packets?"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Option A (Index 0)</label>
                  <input
                    required
                    type="text"
                    value={opt0}
                    onChange={(e) => setOpt0(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Option B (Index 1)</label>
                  <input
                    required
                    type="text"
                    value={opt1}
                    onChange={(e) => setOpt1(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Option C (Index 2)</label>
                  <input
                    required
                    type="text"
                    value={opt2}
                    onChange={(e) => setOpt2(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Option D (Index 3)</label>
                  <input
                    required
                    type="text"
                    value={opt3}
                    onChange={(e) => setOpt3(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Correct Option</label>
                  <select
                    value={correctOption}
                    onChange={(e) => setCorrectOption(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value={0}>Option A (Index 0)</option>
                    <option value={1}>Option B (Index 1)</option>
                    <option value={2}>Option C (Index 2)</option>
                    <option value={3}>Option D (Index 3)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Topic Category</label>
                  <input
                    type="text"
                    value={qCategory}
                    onChange={(e) => setQCategory(e.target.value)}
                    placeholder="e.g. Networking, MS Office, DBMS"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Detailed Explanation</label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Detailed explanation for solution..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-amber-400 text-slate-950 font-black rounded-xl hover:bg-amber-300 uppercase tracking-wider transition"
              >
                {loading ? 'Saving Question...' : 'Save Question to Container'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}