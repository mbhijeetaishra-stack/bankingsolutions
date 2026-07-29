'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

interface Subject {
  id: string;
  name: string;
}

interface Question {
  id: string;
  question_text: string;
  subject_id: string;
  subjects?: { name: string };
}

interface MockTest {
  id: string;
  title: string;
  duration_minutes: number;
  total_marks: number;
  is_published: boolean;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'add_question' | 'bulk_upload' | 'create_mock' | 'direct_mock_upload'>('add_question');

  // --- Common States ---
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // --- Single Question Form State ---
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [solutionText, setSolutionText] = useState('');
const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);

  useEffect(() => {
    verifyAdminAccess();
  }, []);

  async function verifyAdminAccess() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (user && (user.user_metadata?.is_admin === true || user.app_metadata?.role === 'admin')) {
      setIsAdminUser(true);
    } else {
      setIsAdminUser(false);
    }
  }

  // Access Denied Screen for Non-Admins
  if (isAdminUser === false) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="h-16 w-16 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center text-3xl mb-4">
          🔒
        </div>
        <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
        <p className="text-xs text-slate-400 max-w-md mb-6">
          This portal is restricted to BankingSolutions administrators. Please log in with an authorized admin account.
        </p>
        <a
          href="/"
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-6 py-3 rounded-xl transition"
        >
          Return to Homepage
        </a>
      </div>
    );
  }
  // --- Mock Test Builder State ---
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState<string>('ALL');
  const [mockTitle, setMockTitle] = useState('');
  const [mockDuration, setMockDuration] = useState(60);
  const [mockMarks, setMockMarks] = useState(100);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [existingMocks, setExistingMocks] = useState<MockTest[]>([]);

  // --- Direct Mock Upload State ---
  const [directMockTitle, setDirectMockTitle] = useState('');
  const [directMockDuration, setDirectMockDuration] = useState(60);
  const [directMockMarks, setDirectMockMarks] = useState(100);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);

    const { data: subData } = await supabase.from('subjects').select('*');
    if (subData && subData.length > 0) {
      setSubjects(subData);
      setSelectedSubject(subData[0].id);
    }

    const { data: qData } = await supabase
      .from('questions')
      .select('id, question_text, subject_id, subjects(name)');
    if (qData) setAllQuestions(qData as unknown as Question[]);

    const { data: mData } = await supabase
      .from('mock_tests')
      .select('*')
      .order('created_at', { ascending: false });
    if (mData) setExistingMocks(mData);

    setLoading(false);
  }

  // --- Single Question Submit Handler ---
  async function handleQuestionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSubject) return;

    setStatusMsg('Saving question...');

    const { error } = await supabase.from('questions').insert([
      {
        subject_id: selectedSubject,
        question_text: questionText,
        options: options,
        correct_option_index: correctOptionIndex,
        solution_text: solutionText,
      },
    ]);

    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setStatusMsg('✅ Question added successfully!');
      setQuestionText('');
      setOptions(['', '', '', '', '']);
      setSolutionText('');
      setCorrectOptionIndex(0);
      fetchInitialData();
    }
  }

  // --- Excel Bulk Upload Handler (Question Bank) ---
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedSubject) {
      setStatusMsg('⚠️ Please select a subject first before uploading!');
      return;
    }

    setStatusMsg('Reading Excel file...');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          setStatusMsg('⚠️ Excel file is empty!');
          return;
        }

        setStatusMsg(`Uploading ${data.length} questions to database...`);

        const formattedQuestions = data.map((row) => {
          const answerLetter = String(row['Correct Answer'] || 'A').toUpperCase().trim();
          const optionMap: { [key: string]: number } = { A: 0, B: 1, C: 2, D: 3, E: 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
          const correctIdx = optionMap[answerLetter] !== undefined ? optionMap[answerLetter] : 0;

          return {
            subject_id: selectedSubject,
            question_text: String(row['Question Text'] || ''),
            options: [
              String(row['Option A'] || ''),
              String(row['Option B'] || ''),
              String(row['Option C'] || ''),
              String(row['Option D'] || ''),
              String(row['Option E'] || ''),
            ],
            correct_option_index: correctIdx,
            solution_text: String(row['Solution Text'] || ''),
          };
        });

        const { error } = await supabase.from('questions').insert(formattedQuestions);

        if (error) {
          setStatusMsg(`Bulk Upload Error: ${error.message}`);
        } else {
          setStatusMsg(`🎉 Success! Imported ${data.length} questions into bank!`);
          fetchInitialData();
        }
      } catch (err: any) {
        setStatusMsg(`File Error: ${err.message}`);
      }
    };

    reader.readAsBinaryString(file);
  };

  // --- Direct Mock Excel Upload Handler ---
  const handleDirectMockUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!directMockTitle) {
      setStatusMsg('⚠️ Please enter a Mock Test Title first!');
      return;
    }

    if (!selectedSubject) {
      setStatusMsg('⚠️ Please select a default Subject first!');
      return;
    }

    setStatusMsg('Processing Direct Mock Upload...');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          setStatusMsg('⚠️ Excel file is empty!');
          return;
        }

        setStatusMsg(`1/3: Uploading ${data.length} questions...`);

        const formattedQuestions = data.map((row) => {
          const answerLetter = String(row['Correct Answer'] || 'A').toUpperCase().trim();
          const optionMap: { [key: string]: number } = { A: 0, B: 1, C: 2, D: 3, E: 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
          const correctIdx = optionMap[answerLetter] !== undefined ? optionMap[answerLetter] : 0;

          return {
            subject_id: selectedSubject,
            question_text: String(row['Question Text'] || ''),
            options: [
              String(row['Option A'] || ''),
              String(row['Option B'] || ''),
              String(row['Option C'] || ''),
              String(row['Option D'] || ''),
              String(row['Option E'] || ''),
            ],
            correct_option_index: correctIdx,
            solution_text: String(row['Solution Text'] || ''),
          };
        });

        const { data: insertedQuestions, error: qErr } = await supabase
          .from('questions')
          .insert(formattedQuestions)
          .select('id');

        if (qErr || !insertedQuestions) {
          setStatusMsg(`Error inserting questions: ${qErr?.message}`);
          return;
        }

        setStatusMsg('2/3: Creating Mock Test entry...');

        const { data: testData, error: tErr } = await supabase
          .from('mock_tests')
          .insert([
            {
              title: directMockTitle,
              duration_minutes: Number(directMockDuration),
              total_marks: Number(directMockMarks),
              is_published: true,
            },
          ])
          .select();

        if (tErr || !testData) {
          setStatusMsg(`Error creating test: ${tErr?.message}`);
          return;
        }

        const createdTestId = testData[0].id;

        setStatusMsg('3/3: Linking questions to Mock Test...');

        const mappings = insertedQuestions.map((q, idx) => ({
          mock_test_id: createdTestId,
          question_id: q.id,
          order_index: idx + 1,
        }));

        const { error: mapErr } = await supabase.from('mock_test_questions').insert(mappings);

        if (mapErr) {
          setStatusMsg(`Error linking questions: ${mapErr.message}`);
        } else {
          setStatusMsg(`🎉 Direct Upload Complete! Created "${directMockTitle}" with ${data.length} questions!`);
          setDirectMockTitle('');
          fetchInitialData();
        }
      } catch (err: any) {
        setStatusMsg(`Direct Upload Error: ${err.message}`);
      }
    };

    reader.readAsBinaryString(file);
  };

  // --- Manual Mock Test Creation Handler ---
  async function handleMockTestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedQuestionIds.length === 0) {
      setStatusMsg('⚠️ Please select at least 1 question for the mock test!');
      return;
    }

    setStatusMsg('Creating Mock Test...');

    const { data: testData, error: testError } = await supabase
      .from('mock_tests')
      .insert([
        {
          title: mockTitle,
          duration_minutes: Number(mockDuration),
          total_marks: Number(mockMarks),
          is_published: true,
        },
      ])
      .select();

    if (testError || !testData) {
      setStatusMsg(`Error: ${testError?.message}`);
      return;
    }

    const createdTestId = testData[0].id;

    const questionMappings = selectedQuestionIds.map((qId, idx) => ({
      mock_test_id: createdTestId,
      question_id: qId,
      order_index: idx + 1,
    }));

    const { error: mapError } = await supabase.from('mock_test_questions').insert(questionMappings);

    if (mapError) {
      setStatusMsg(`Error adding questions: ${mapError.message}`);
    } else {
      setStatusMsg(`✅ Mock Test "${mockTitle}" created with ${selectedQuestionIds.length} questions!`);
      setMockTitle('');
      setSelectedQuestionIds([]);
      fetchInitialData();
    }
  }

  // --- Delete Mock Test Handler ---
  async function handleDeleteMockTest(testId: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    setStatusMsg('Deleting Mock Test...');

    await supabase.from('mock_test_questions').delete().eq('mock_test_id', testId);
    const { error } = await supabase.from('mock_tests').delete().eq('id', testId);

    if (error) {
      setStatusMsg(`Delete Error: ${error.message}`);
    } else {
      setStatusMsg(`🗑️ Deleted "${title}" successfully.`);
      fetchInitialData();
    }
  }

  // --- Delete Selected Questions Handler ---
  async function handleDeleteSelectedQuestions() {
    if (selectedQuestionIds.length === 0) {
      setStatusMsg('⚠️ Please select questions to delete first!');
      return;
    }

    if (!confirm(`Are you sure you want to PERMANENTLY DELETE ${selectedQuestionIds.length} selected question(s)?`)) {
      return;
    }

    setStatusMsg(`Deleting ${selectedQuestionIds.length} question(s)...`);

    const { error } = await supabase.from('questions').delete().in('id', selectedQuestionIds);

    if (error) {
      setStatusMsg(`Delete Error: ${error.message}`);
    } else {
      setStatusMsg(`🗑️ Successfully deleted ${selectedQuestionIds.length} question(s) from Question Bank!`);
      setSelectedQuestionIds([]);
      fetchInitialData();
    }
  }

  // --- Delete Single Question Handler ---
  async function handleDeleteSingleQuestion(qId: string) {
    if (!confirm('Are you sure you want to delete this question?')) return;

    setStatusMsg('Deleting question...');
    const { error } = await supabase.from('questions').delete().eq('id', qId);

    if (error) {
      setStatusMsg(`Delete Error: ${error.message}`);
    } else {
      setStatusMsg('🗑️ Question deleted successfully.');
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== qId));
      fetchInitialData();
    }
  }

  const toggleQuestionSelection = (qId: string) => {
    if (selectedQuestionIds.includes(qId)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== qId));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, qId]);
    }
  };

  const filteredQuestions = filterSubjectId === 'ALL'
    ? allQuestions
    : allQuestions.filter((q) => q.subject_id === filterSubjectId);

  // --- Select All / Deselect All Toggle ---
  const isAllFilteredSelected = filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedQuestionIds.includes(q.id));

  const handleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      // Unselect filtered
      const filteredIds = new Set(filteredQuestions.map((q) => q.id));
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => !filteredIds.has(id)));
    } else {
      // Select all filtered
      const filteredIds = filteredQuestions.map((q) => q.id);
      const combined = Array.from(new Set([...selectedQuestionIds, ...filteredIds]));
      setSelectedQuestionIds(combined);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">BankingSolutions Admin</h1>
          <p className="text-xs text-slate-500">Manage Question Bank & Mock Test Series</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs flex-wrap gap-y-1">
          <button
            onClick={() => setActiveTab('add_question')}
            className={`px-3 py-1.5 font-semibold rounded-md transition ${
              activeTab === 'add_question' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + Single Question
          </button>
          <button
            onClick={() => setActiveTab('bulk_upload')}
            className={`px-3 py-1.5 font-semibold rounded-md transition ${
              activeTab === 'bulk_upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📥 Bank Upload
          </button>
          <button
            onClick={() => setActiveTab('direct_mock_upload')}
            className={`px-3 py-1.5 font-semibold rounded-md transition ${
              activeTab === 'direct_mock_upload' ? 'bg-white text-emerald-700 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🚀 Direct Mock Upload
          </button>
          <button
            onClick={() => setActiveTab('create_mock')}
            className={`px-3 py-1.5 font-semibold rounded-md transition ${
              activeTab === 'create_mock' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Build & Manage Mocks
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="mb-6 p-3 bg-slate-100 border border-slate-200 text-slate-800 rounded text-sm font-medium">
          {statusMsg}
        </div>
      )}

      {/* --- TAB 1: ADD SINGLE QUESTION --- */}
      {activeTab === 'add_question' && (
        <form onSubmit={handleQuestionSubmit} className="bg-white shadow-md rounded-lg p-6 border border-slate-200">
          <h2 className="text-lg font-semibold mb-4 text-slate-700">Add Single Question to Bank</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-slate-800 bg-white"
              required
            >
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Question Text</label>
            <textarea
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Enter question statement..."
              className="w-full border border-slate-300 rounded p-2 text-slate-800"
              required
            />
          </div>

          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.map((opt, idx) => (
              <div key={idx} className={idx === 4 ? 'md:col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Option {String.fromCharCode(65 + idx)}
                </label>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const updated = [...options];
                    updated[idx] = e.target.value;
                    setOptions(updated);
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                  className="w-full border border-slate-300 rounded p-2 text-slate-800"
                  required
                />
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Correct Answer Option</label>
            <select
              value={correctOptionIndex}
              onChange={(e) => setCorrectOptionIndex(Number(e.target.value))}
              className="w-full border border-slate-300 rounded p-2 text-slate-800 bg-white"
            >
              <option value={0}>Option A</option>
              <option value={1}>Option B</option>
              <option value={2}>Option C</option>
              <option value={3}>Option D</option>
              <option value={4}>Option E</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Solution / Explanation</label>
            <textarea
              rows={3}
              value={solutionText}
              onChange={(e) => setSolutionText(e.target.value)}
              placeholder="Explain solution step-by-step..."
              className="w-full border border-slate-300 rounded p-2 text-slate-800"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded transition"
          >
            Add Question to Database
          </button>
        </form>
      )}

      {/* --- TAB 2: EXCEL QUESTION BANK UPLOAD --- */}
      {activeTab === 'bulk_upload' && (
        <div className="bg-white shadow-md rounded-lg p-6 border border-slate-200">
          <h2 className="text-lg font-semibold mb-2 text-slate-700">Import Questions into Question Bank</h2>
          <p className="text-xs text-slate-500 mb-6">Upload a spreadsheet of questions into your master Question Bank.</p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Target Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-slate-800 bg-white"
            >
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name}
                </option>
              ))}
            </select>
          </div>

          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center bg-slate-50 transition cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleExcelUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-slate-600">
              <span className="text-3xl block mb-2">📄</span>
              <p className="font-semibold text-sm">Click to browse or drag & drop your Excel (.xlsx / .csv) file</p>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: DIRECT MOCK EXCEL UPLOAD --- */}
      {activeTab === 'direct_mock_upload' && (
        <div className="bg-white shadow-md rounded-lg p-6 border border-slate-200">
          <div className="flex items-center space-x-2 mb-2">
            <h2 className="text-lg font-semibold text-slate-800">🚀 1-Click Direct Mock Upload from Excel</h2>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">Fastest</span>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Enter test details, select your Excel file, and publish a full mock test instantly.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mock Test Title</label>
              <input
                type="text"
                value={directMockTitle}
                onChange={(e) => setDirectMockTitle(e.target.value)}
                placeholder="e.g. SBI PO Prelims - Full Mock 02"
                className="w-full border border-slate-300 rounded p-2 text-slate-800 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
              <input
                type="number"
                value={directMockDuration}
                onChange={(e) => setDirectMockDuration(Number(e.target.value))}
                className="w-full border border-slate-300 rounded p-2 text-slate-800 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total Marks</label>
              <input
                type="number"
                value={directMockMarks}
                onChange={(e) => setDirectMockMarks(Number(e.target.value))}
                className="w-full border border-slate-300 rounded p-2 text-slate-800 text-sm"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Default Subject for Questions</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-slate-800 bg-white text-sm"
            >
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name}
                </option>
              ))}
            </select>
          </div>

          <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-8 text-center bg-emerald-50/50 transition cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleDirectMockUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-emerald-900">
              <span className="text-3xl block mb-2">📊</span>
              <p className="font-bold text-sm">Upload Mock Test Excel File</p>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: MOCK BUILDER & QUESTION BANK MANAGEMENT --- */}
      {activeTab === 'create_mock' && (
        <div className="space-y-8">
          <form onSubmit={handleMockTestSubmit} className="bg-white shadow-md rounded-lg p-6 border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 text-slate-700">Build Mock Test & Manage Questions</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Test Title</label>
                <input
                  type="text"
                  value={mockTitle}
                  onChange={(e) => setMockTitle(e.target.value)}
                  placeholder="e.g. SBI PO Prelims - Mock 1"
                  className="w-full border border-slate-300 rounded p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  value={mockDuration}
                  onChange={(e) => setMockDuration(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Total Marks</label>
                <input
                  type="number"
                  value={mockMarks}
                  onChange={(e) => setMockMarks(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded p-2 text-slate-800"
                />
              </div>
            </div>

            {/* Subject Filter + Select All + Delete Questions Toolbar */}
            <div className="mb-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Question Bank Manager</label>
                  <p className="text-xs text-slate-500">
                    Selected: <span className="font-bold text-blue-600">{selectedQuestionIds.length} Questions</span>
                  </p>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold px-3 py-1.5 rounded transition"
                  >
                    {isAllFilteredSelected ? 'Deselect All' : 'Select All Filtered'}
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSelectedQuestions}
                    disabled={selectedQuestionIds.length === 0}
                    className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                      selectedQuestionIds.length > 0
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Delete Selected ({selectedQuestionIds.length}) 🗑️
                  </button>
                </div>
              </div>

              {/* Subject Filter Dropdown */}
              <select
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-slate-800 bg-white text-sm"
              >
                <option value="ALL">All Subjects ({allQuestions.length} Questions in Bank)</option>
                {subjects.map((subj) => {
                  const count = allQuestions.filter((q) => q.subject_id === subj.id).length;
                  return (
                    <option key={subj.id} value={subj.id}>
                      {subj.name} ({count} Questions)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Questions Checklist with Individual Delete */}
            <div className="mb-6">
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white p-2">
                {filteredQuestions.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 text-center">No questions found in database.</p>
                ) : (
                  filteredQuestions.map((q) => {
                    const isSelected = selectedQuestionIds.includes(q.id);
                    return (
                      <div
                        key={q.id}
                        className={`p-3 rounded transition flex items-start justify-between space-x-3 text-xs ${
                          isSelected ? 'bg-blue-50/70 border border-blue-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div
                          onClick={() => toggleQuestionSelection(q.id)}
                          className="flex items-start space-x-3 cursor-pointer flex-1"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-blue-600"
                          />
                          <div>
                            <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded mr-2">
                              {q.subjects?.name || 'Subject'}
                            </span>
                            <span className="text-slate-800 font-medium">{q.question_text}</span>
                          </div>
                        </div>

                        {/* Individual Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteSingleQuestion(q.id)}
                          className="text-rose-500 hover:text-rose-700 font-bold px-2 py-0.5 hover:bg-rose-50 rounded transition text-xs"
                          title="Delete this question"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded transition shadow-sm"
            >
              Publish Selected Questions as Mock Test
            </button>
          </form>

          {/* Published List */}
          <div className="bg-white shadow-md rounded-lg p-6 border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 text-slate-700">Published Mock Tests</h2>
            {existingMocks.length === 0 ? (
              <p className="text-xs text-slate-500">No published mock tests yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {existingMocks.map((test) => (
                  <div key={test.id} className="py-3 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-slate-800 text-sm">{test.title}</h3>
                      <p className="text-xs text-slate-500">
                        {test.duration_minutes} Mins | {test.total_marks} Marks
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded">
                        Live
                      </span>
                      <button
                        onClick={() => handleDeleteMockTest(test.id, test.title)}
                        className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold text-xs px-2.5 py-1 rounded transition"
                      >
                        Delete 🗑️
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
  );
}