'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Subject {
  id: string;
  name: string;
}

interface Question {
  id: string;
  question_text: string;
  subject_id: string;
  options?: string[];
  correct_option_index?: number;
  solution_text?: string;
  subjects?: { name: string };
}

interface MockTest {
  id: string;
  title: string;
  exam_type?: string;
  sub_category_id?: string;
  duration_minutes: number;
  total_marks: number;
  cutoff_marks?: number;
  is_published: boolean;
  questions?: any[];
}

interface ExamSubCategory {
  id: string;
  parent_exam_name: string;
  sub_card_title: string;
  description?: string;
  display_order: number;
  created_at?: string;
}

interface ExamCategory {
  id: string;
  exam_name: string;
  sub_category: string;
  total_duration_minutes: number;
  sections: { name: string; time_minutes: number }[];
}

interface PdfCourse {
  id: string;
  title: string;
  category: 'BSPS' | 'BSCA';
  description?: string;
}

interface CoursePdf {
  id: string;
  course_id: string;
  day_number: number;
  title: string;
  topic_list?: string;
  pdf_url: string;
}

interface UpdatePost {
  id: string;
  category: 'ONE_LINER' | 'NOTIFICATION' | 'RESULT' | 'EXPECTED_CUTOFF' | 'EXAM_ANALYSIS';
  title: string;
  content: string;
  exam_tag: string;
  is_pinned: boolean;
  post_date: string;
  image_url?: string;
  external_link?: string;
  created_at: string;
}

interface EBook {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  pdf_url: string;
  price: number;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    | 'updates_publisher'
    | 'sub_cards_manager'
    | 'bsca_quiz_builder'
    | 'pdf_uploader'
    | 'direct_mock_upload'
    | 'create_exam_tab'
    | 'create_mock'
    | 'add_question'
    | 'bulk_upload'
    | 'targets_manager'
    | 'mock_analytics'
    | 'computer_quiz'
    | 'ebook_manager'
  >('updates_publisher');

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState('');

  // Sub-Cards / Exam Sub-Categories States
  const [subCategories, setSubCategories] = useState<ExamSubCategory[]>([]);
  const [subCardParentExam, setSubCardParentExam] = useState('IBPS PO');
  const [subCardTitleInput, setSubCardTitleInput] = useState('Prelims 2026 Test Series');
  const [subCardDescInput, setSubCardDescInput] = useState('');

  // Hierarchical Exam Creator States
  const [parentExamName, setParentExamName] = useState('IBPS PO');
  const [subCategoryType, setSubCategoryType] = useState('Prelims');
  const [newExamDuration, setNewExamDuration] = useState(60);
  const [examSections, setExamSections] = useState<{ name: string; time_minutes: number }[]>([
    { name: 'Quantitative Aptitude', time_minutes: 20 },
    { name: 'Reasoning Ability', time_minutes: 20 },
    { name: 'English Language', time_minutes: 20 },
  ]);
  const [dynamicExamsList, setDynamicExamsList] = useState<ExamCategory[]>([]);

  // Single Question Form State
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [solutionText, setSolutionText] = useState('');

  // Mock Test Builder State
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState<string>('ALL');
  const [mockTitle, setMockTitle] = useState('');
  const [mockExamType, setMockExamType] = useState('IBPS PO - Prelims');
  const [mockSubCategoryId, setMockSubCategoryId] = useState('');
  const [mockDuration, setMockDuration] = useState(60);
  const [mockMarks, setMockMarks] = useState(100);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [existingMocks, setExistingMocks] = useState<MockTest[]>([]);

  // Direct Mock Upload State
  const [directMockTitle, setDirectMockTitle] = useState('');
  const [directMockExamType, setDirectMockExamType] = useState('IBPS PO - Prelims');
  const [directMockSubCategoryId, setDirectMockSubCategoryId] = useState('');
  const [directMockDuration, setDirectMockDuration] = useState(60);
  const [directMockMarks, setDirectMockMarks] = useState(100);
  const [directMockCutoff, setDirectMockCutoff] = useState(55);
  const [pendingDirectMock, setPendingDirectMock] = useState<any>(null);

  // Inline Cut-off Editor States for Old Mocks
  const [editingCutoffId, setEditingCutoffId] = useState<string | null>(null);
  const [tempCutoffValue, setTempCutoffValue] = useState<number>(55);

  // Mock Analytics States
  const [selectedAnalyticsMockId, setSelectedAnalyticsMockId] = useState<string>('');
  const [mockAttemptsList, setMockAttemptsList] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // PDF Course & File Upload States (BSPS / BSCA)
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCategory, setCourseCategory] = useState<'BSPS' | 'BSCA'>('BSPS');
  const [courseDesc, setCourseDesc] = useState('');
  const [existingCourses, setExistingCourses] = useState<PdfCourse[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [dayNumber, setDayNumber] = useState(1);
  const [pdfTitle, setPdfTitle] = useState('');
  const [topicList, setTopicList] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadedPdfs, setUploadedPdfs] = useState<CoursePdf[]>([]);

  // Updates & One-Liners Publisher States
  const [postCategory, setPostCategory] = useState<'ONE_LINER' | 'NOTIFICATION' | 'RESULT' | 'EXPECTED_CUTOFF' | 'EXAM_ANALYSIS'>('ONE_LINER');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postExamTag, setPostExamTag] = useState('SBI PO');
  const [postIsPinned, setPostIsPinned] = useState(false);
  const [publishedFeed, setPublishedFeed] = useState<UpdatePost[]>([]);
  const [postDate, setPostDate] = useState(new Date().toISOString().split('T')[0]);
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postExternalLink, setPostExternalLink] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  // BSCA Quiz Builder States
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDate, setQuizDate] = useState(new Date().toISOString().split('T')[0]);
  const [quizDuration, setQuizDuration] = useState(10);
  const [existingQuizzes, setExistingQuizzes] = useState<any[]>([]);

  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [quizQuestionText, setQuizQuestionText] = useState('');
  const [quizOptions, setQuizOptions] = useState(['', '', '', '']);
  const [quizCorrectOption, setQuizCorrectOption] = useState(0);
  const [quizExplanation, setQuizExplanation] = useState('');

  const [bscaQuizQuestions, setBscaQuizQuestions] = useState<any[]>([]);
  const [editingQuizQuestionId, setEditingQuizQuestionId] = useState<string | null>(null);

  // Daily Targets, Countdowns & Day-Wise Checklist Manager States
  const [targetDayNo, setTargetDayNo] = useState(1);
  const [targetTrackMode, setTargetTrackMode] = useState<'beginner' | 'repeater'>('beginner');
  const [targetVideoUrl, setTargetVideoUrl] = useState('');
  const [allConfiguredTargets, setAllConfiguredTargets] = useState<any[]>([]);

  const [examNameInput, setExamNameInput] = useState('');
  const [examDateInput, setExamDateInput] = useState('');
  const [adminExamsList, setAdminExamsList] = useState<any[]>([]);

  const [dayChecklistInput, setDayChecklistInput] = useState('');
  const [dayChecklistItems, setDayChecklistItems] = useState<any[]>([]);

  const [marqueeInput, setMarqueeInput] = useState('');
  const [adminMarqueeList, setAdminMarqueeList] = useState<any[]>([]);

  // Computer Awareness Markdown Chapter States, MCQ PDF URL & Launch Offer Timer
  const [compChapters, setCompChapters] = useState<any[]>([]);
  const [compTitle, setCompTitle] = useState('');
  const [compMarkdown, setCompMarkdown] = useState('');
  const [compChapterNo, setCompChapterNo] = useState(1);
  const [isLocked, setIsLocked] = useState(true);
  const [compPdfUrl, setCompPdfUrl] = useState('');
  const [launchOfferEnd, setLaunchOfferEnd] = useState('');
  const [savingTimer, setSavingTimer] = useState(false);

  // E-Book States
  const [eBookTitle, setEBookTitle] = useState('');
  const [eBookAuthor, setEBookAuthor] = useState('');
  const [eBookDesc, setEBookDesc] = useState('');
  const [eBookPrice, setEBookPrice] = useState(0);
  const [eBookFile, setEBookFile] = useState<File | null>(null);
  const [eBookCover, setEBookCover] = useState<File | null>(null);
  const [allEBooks, setAllEBooks] = useState<EBook[]>([]);

  useEffect(() => {
    checkAdminAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchDaySpecificData(targetDayNo, targetTrackMode);
      fetchComputerChapters();
      fetchAdminSettings();
      fetchEBooks();
    }
  }, [targetDayNo, targetTrackMode, isAdmin]);

  useEffect(() => {
    if (selectedQuizId) {
      fetchBscaQuizQuestions(selectedQuizId);
    } else {
      setBscaQuizQuestions([]);
    }
  }, [selectedQuizId]);

  async function checkAdminAuth() {
    setCheckingAuth(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      setIsAdmin(false);
      setCheckingAuth(false);
      return;
    }

    const user = session.user;
    if (user.user_metadata?.is_admin === true || user.app_metadata?.role === 'admin') {
      setIsAdmin(true);
      fetchInitialData();
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profile && profile.is_admin === true) {
        setIsAdmin(true);
        fetchInitialData();
      } else {
        setIsAdmin(false);
      }
    }
    setCheckingAuth(false);
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setAuthError(error.message);
    } else if (data.user) {
      checkAdminAuth();
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsAdmin(false);
  }

  async function fetchInitialData() {
    const { data: subData } = await supabase.from('subjects').select('*');
    if (subData && subData.length > 0) {
      setSubjects(subData);
      setSelectedSubject(subData[0].id);
    }

    const { data: subCatData } = await supabase
      .from('exam_sub_categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (subCatData) {
      setSubCategories(subCatData);
      if (subCatData.length > 0) {
        setDirectMockSubCategoryId(subCatData[0].id);
        setMockSubCategoryId(subCatData[0].id);
      }
    }

    const { data: examCatData } = await supabase.from('exam_categories').select('*').order('created_at', { ascending: false });
    if (examCatData) {
      setDynamicExamsList(examCatData);
    }

    const { data: qData } = await supabase
      .from('questions')
      .select('id, question_text, subject_id, options, correct_option_index, solution_text, subjects(name)');
    if (qData) setAllQuestions(qData as unknown as Question[]);

    const { data: mData } = await supabase
      .from('mock_tests')
      .select('*')
      .order('created_at', { ascending: false });
    if (mData) setExistingMocks(mData);

    const { data: cData } = await supabase
      .from('pdf_courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (cData) setExistingCourses(cData as PdfCourse[]);

    const { data: pData } = await supabase
      .from('course_pdfs')
      .select('*')
      .order('day_number', { ascending: true });
    if (pData) setUploadedPdfs(pData as CoursePdf[]);

    const { data: uData } = await supabase
      .from('updates_feed')
      .select('*')
      .order('created_at', { ascending: false });
    if (uData) setPublishedFeed(uData as UpdatePost[]);

    const { data: quizData } = await supabase
      .from('bsca_quizzes')
      .select('*')
      .order('quiz_date', { ascending: false });
    if (quizData) setExistingQuizzes(quizData);

    const { data: targetListData } = await supabase.from('admin_targets_config').select('*').order('day_number', { ascending: true });
    if (targetListData) {
      setAllConfiguredTargets(targetListData);
    }

    const { data: examCountdownData } = await supabase.from('admin_exam_countdowns').select('*').order('exam_date', { ascending: true });
    if (examCountdownData) {
      setAdminExamsList(examCountdownData);
    }

    const { data: marqueeData } = await supabase.from('admin_marquee_notices').select('*').order('display_order', { ascending: true });
    if (marqueeData) {
      setAdminMarqueeList(marqueeData);
    }

    fetchDaySpecificData(targetDayNo, targetTrackMode);
    fetchComputerChapters();
    fetchAdminSettings();
    fetchEBooks();
  }

  // --- SUB-CARDS / EXAM SUB-CATEGORIES FUNCTIONS ---
  async function handleCreateSubCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!subCardTitleInput.trim()) return setStatusMsg('⚠️ Enter Sub-Card Title!');

    setStatusMsg('Creating Exam Sub-Card...');
    const { error } = await supabase.from('exam_sub_categories').insert([
      {
        parent_exam_name: subCardParentExam,
        sub_card_title: subCardTitleInput.trim(),
        description: subCardDescInput.trim() || null,
        display_order: subCategories.length + 1,
      },
    ]);

    if (error) {
      setStatusMsg(`Error creating sub-card: ${error.message}`);
    } else {
      setStatusMsg(`🎉 Created Sub-Card "${subCardTitleInput}" under ${subCardParentExam}!`);
      setSubCardTitleInput('');
      setSubCardDescInput('');
      fetchInitialData();
    }
  }

  async function handleDeleteSubCategory(id: string, title: string) {
    if (!confirm(`Delete sub-card "${title}"? Associated mocks linked to it will also be deleted!`)) return;

    const { error } = await supabase.from('exam_sub_categories').delete().eq('id', id);
    if (!error) {
      setStatusMsg(`🗑️ Deleted sub-card "${title}".`);
      fetchInitialData();
    } else {
      setStatusMsg(`Delete Error: ${error.message}`);
    }
  }

  async function fetchComputerChapters() {
    const { data } = await supabase.from('admin_computer_chapters').select('*').order('chapter_number');
    if (data) setCompChapters(data);
  }

  async function fetchAdminSettings() {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('launch_offer_ends_at')
      .single();

    if (!error && data?.launch_offer_ends_at) {
      const formattedDate = new Date(data.launch_offer_ends_at).toISOString().slice(0, 16);
      setLaunchOfferEnd(formattedDate);
    }
  }

  async function fetchEBooks() {
    const { data } = await supabase.from('ebooks').select('*');
    if (data) setAllEBooks(data);
  }

  const handleSaveTimer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTimer(true);

    const { error } = await supabase.from('admin_settings').upsert([
      { id: 1, launch_offer_ends_at: new Date(launchOfferEnd).toISOString() }
    ], { onConflict: 'id' });

    if (error) {
      setStatusMsg('Error saving timer: ' + error.message);
    } else {
      setStatusMsg('🎉 Launch offer countdown timer updated successfully!');
    }
    setSavingTimer(false);
  };

  async function handleSaveComputerChapter(e: React.FormEvent) {
    e.preventDefault();
    if (!compTitle.trim() || !compMarkdown.trim()) return setStatusMsg('⚠️ Please enter Title and Markdown!');

    setStatusMsg('Saving Computer Awareness Chapter...');
    const { error } = await supabase.from('admin_computer_chapters').upsert([{
      chapter_number: compChapterNo,
      title: compTitle,
      subtitle: 'Computer Awareness Chapter',
      markdown_content: compMarkdown,
      is_locked: isLocked,
      pdf_mcq_url: compPdfUrl.trim() || null
    }], { onConflict: 'chapter_number' });

    if (error) setStatusMsg(`Error: ${error.message}`);
    else {
      setStatusMsg('✅ Chapter Saved Successfully!');
      setCompTitle('');
      setCompMarkdown('');
      setCompPdfUrl('');
      fetchComputerChapters();
    }
  }

  async function handleDeleteComputerChapter(id: string) {
    if (!confirm('Are you sure you want to delete this chapter?')) return;
    const { error } = await supabase.from('admin_computer_chapters').delete().eq('id', id);
    if (!error) {
      setStatusMsg('🗑️ Chapter deleted.');
      fetchComputerChapters();
    } else {
      setStatusMsg(`Error deleting: ${error.message}`);
    }
  }

  async function handleUploadEBook(e: React.FormEvent) {
    e.preventDefault();
    if (!eBookFile || !eBookCover) return setStatusMsg('⚠️ Please upload both PDF and Cover Image!');
    
    setStatusMsg('Uploading E-Book...');
    try {
      const pdfPath = `ebooks/${Date.now()}_${eBookFile.name}`;
      await supabase.storage.from('course_pdfs').upload(pdfPath, eBookFile);
      const pdfUrl = supabase.storage.from('course_pdfs').getPublicUrl(pdfPath).data.publicUrl;

      const coverPath = `covers/${Date.now()}_${eBookCover.name}`;
      await supabase.storage.from('course_pdfs').upload(coverPath, eBookCover);
      const coverUrl = supabase.storage.from('course_pdfs').getPublicUrl(coverPath).data.publicUrl;

      const { error } = await supabase.from('ebooks').insert([{
        title: eBookTitle, author: eBookAuthor, description: eBookDesc,
        price: eBookPrice, pdf_url: pdfUrl, cover_url: coverUrl
      }]);

      if (error) throw error;
      setStatusMsg('✅ E-Book Published Successfully!');
      setEBookTitle('');
      setEBookAuthor('');
      setEBookDesc('');
      setEBookPrice(0);
      setEBookFile(null);
      setEBookCover(null);
      fetchEBooks();
    } catch (err: any) {
      setStatusMsg(`Upload Error: ${err.message}`);
    }
  }

  async function handleDeleteEBook(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete e-book "${title}"?`)) return;
    const { error } = await supabase.from('ebooks').delete().eq('id', id);
    if (!error) {
      setStatusMsg('🗑️ E-book deleted.');
      fetchEBooks();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
  }

  async function fetchBscaQuizQuestions(quizId: string) {
    const { data, error } = await supabase
      .from('bsca_quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setBscaQuizQuestions(data);
    } else {
      setBscaQuizQuestions([]);
    }
  }

  async function fetchMockAnalytics(mockId: string) {
    if (!mockId) return;
    setLoadingAnalytics(true);

    const { data: rawAttempts, error: rawErr } = await supabase
      .from('mock_attempts')
      .select('*')
      .eq('test_id', mockId)
      .order('score', { ascending: false });

    if (rawErr || !rawAttempts || rawAttempts.length === 0) {
      setMockAttemptsList([]);
      setLoadingAnalytics(false);
      return;
    }

    const userIds = Array.from(new Set(rawAttempts.map((a: any) => a.user_id).filter(Boolean)));
    let profilesMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, student_name, full_name, email')
        .in('id', userIds);

      if (profilesData) {
        profilesData.forEach((p: any) => {
          profilesMap[p.id] = p.student_name || p.full_name || p.email?.split('@')[0] || 'Aspirant';
        });
      }
    }

    const formattedData = rawAttempts.map((item: any) => ({
      ...item,
      aspirant_name: profilesMap[item.user_id] || item.student_name || 'Aspirant',
    }));

    setMockAttemptsList(formattedData);
    setLoadingAnalytics(false);
  }

  async function handleRecalculateScores(mockId: string) {
    if (!confirm("Are you sure you want to recalculate scores for ALL students?")) return;

    setStatusMsg("Fetching data for score matching...");
    setLoadingAnalytics(true);

    try {
      // 1. Fetch test questions and check-off parsing if it's a string
      const { data: testData, error: testErr } = await supabase
        .from('mock_tests')
        .select('questions, total_marks')
        .eq('id', mockId)
        .single();

      if (testErr || !testData) throw new Error("Could not fetch test questions.");
      
      let questions: any[] = [];
      if (typeof testData.questions === 'string') {
        try { questions = JSON.parse(testData.questions); } catch (e) {}
      } else if (Array.isArray(testData.questions)) {
        questions = testData.questions;
      }

      // 2. Fetch all attempts for this test
      const { data: attempts, error: attErr } = await supabase
        .from('mock_attempts')
        .select('*')
        .eq('test_id', mockId);

      if (attErr) throw new Error("Could not fetch student attempts.");
      if (!attempts || attempts.length === 0) {
        setStatusMsg("No attempts found to recalculate.");
        setLoadingAnalytics(false);
        return;
      }

      // 3. Loop through each student attempt and evaluate against questions
      for (const attempt of attempts) {
        let newScore = 0;
        
        // Grab from 'answers' first (since your DB sample had data there), fallback to 'user_answers'
        let userResponses = attempt.answers || attempt.user_answers || {};
        if (typeof userResponses === 'string') {
          try { userResponses = JSON.parse(userResponses); } catch (e) { userResponses = {}; }
        }

        questions.forEach((q: any, idx: number) => {
          // Robust lookup supporting q.id, numeric index (idx), and string index ('0', '1', etc.)
          const selectedOption = userResponses[q.id] !== undefined 
            ? userResponses[q.id] 
            : (userResponses[idx] !== undefined ? userResponses[idx] : userResponses[String(idx)]);

          if (selectedOption !== undefined && selectedOption !== null && selectedOption !== '') {
            if (Number(selectedOption) === Number(q.correctOptionIndex)) {
              newScore += Number(q.marks || 1.0);     
            } else {
              newScore -= Number(q.negativeMarks || 0.25); 
            }
          }
        });

        // Ensure score doesn't drop below 0
        const finalScore = Number(Math.max(0, newScore).toFixed(2));

        // Update the score back into Supabase
        await supabase
          .from('mock_attempts')
          .update({ score: finalScore })
          .eq('id', attempt.id);
      }

      setStatusMsg(`🎉 Successfully recalculated scores for ${attempts.length} students!`);
      fetchMockAnalytics(mockId);
      
    } catch (error: any) {
      setStatusMsg(`❌ Recalculation Error: ${error.message}`);
      setLoadingAnalytics(false);
    }
  }

  const handleDirectMockUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!directMockTitle.trim()) return setStatusMsg('⚠️ Please enter a Mock Test Title first!');

    setStatusMsg('Processing Direct Mock Upload...');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) return setStatusMsg('⚠️ Excel file is empty!');

        const formattedJSONQuestions = data.map((row, idx) => {
          let rawSec = String(row.section || row.Subject || row.SECTION || row.SUBJECT || '').trim().toUpperCase();
          let normSec = 'QUANT';

          if (rawSec.includes('ENG')) normSec = 'ENGLISH';
          else if (rawSec.includes('REASON')) normSec = 'REASONING';
          else if (rawSec.includes('QUANT') || rawSec.includes('MATH')) normSec = 'QUANT';
          else if (rawSec.includes('GA') || rawSec.includes('CURRENT') || rawSec.includes('AWARE') || rawSec.includes('GS')) normSec = 'GA';
          else if (rawSec.includes('HIN')) normSec = 'HINDI';

          const answerLetter = String(row.correctOptionIndex ?? row['Correct Answer'] ?? row.correctOption ?? '0').toUpperCase().trim();
          const optionMap: { [key: string]: number } = { A: 0, B: 1, C: 2, D: 3, E: 4, '0': 0, '1': 1, '2': 2, '3': 3, '4': 4 };
          const correctIdx = optionMap[answerLetter] !== undefined ? optionMap[answerLetter] : 0;

          const qText = String(
            row.questionText || row.question_text || row['Question Text'] || row.Question || row.statement || row.Text || row.question || `Question ${idx + 1}`
          ).trim();

          const pText = String(
            row.passageText || row.passage_text || row.passage || row.Direction || row.direction || row['Solution Text'] || ''
          ).trim();

          const explanationText = String(
            row.explanation || row.Explanation || row.Solution || row.solution || row.solution_text || ''
          ).trim();

          const options = [
            String(row.optionA || row['Option A'] || row.option_1 || row.option1 || row.A || row.choice1 || row.ChoiceA || '').trim(),
            String(row.optionB || row['Option B'] || row.option_2 || row.option2 || row.B || row.choice2 || row.ChoiceB || '').trim(),
            String(row.optionC || row['Option C'] || row.option_3 || row.option3 || row.C || row.choice3 || row.ChoiceC || '').trim(),
            String(row.optionD || row['Option D'] || row.option_4 || row.option4 || row.D || row.choice4 || row.ChoiceD || '').trim(),
            String(row.optionE || row['Option E'] || row.option_5 || row.option5 || row.E || row.choice5 || row.ChoiceE || '').trim(),
          ].filter(Boolean);

          return {
            id: `q-${idx + 1}-${Date.now()}`,
            section: normSec,
            passageText: pText,
            questionText: qText,
            options: options.length > 0 ? options : ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'],
            correctOptionIndex: correctIdx,
            marks: Number(row.marks ?? 1.0),
            negativeMarks: Number(row.negativeMarks ?? 0.25),
            explanation: explanationText,
          };
        });

        const payload = {
          title: directMockTitle.trim(),
          exam_type: directMockExamType,
          sub_category_id: directMockSubCategoryId || null,
          duration_minutes: Number(directMockDuration),
          total_marks: Number(directMockMarks),
          cutoff_marks: Number(directMockCutoff),
          questions: formattedJSONQuestions,
          is_published: true,
          created_at: new Date().toISOString(),
        };

        setPendingDirectMock(payload);
        setStatusMsg(`✅ Excel parsed successfully! Review and click Publish Mock Test below.`);
      } catch (err: any) {
        setStatusMsg(`Direct Upload Error: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  async function handlePublishPendingMock() {
    if (!pendingDirectMock) return;
    setStatusMsg(`Publishing "${pendingDirectMock.title}"...`);

    try {
      const { data: testData, error: tErr } = await supabase.from('mock_tests').insert([pendingDirectMock]).select();

      if (tErr || !testData) return setStatusMsg(`Publish Error: ${tErr?.message}`);

      setStatusMsg(`🎉 Successfully published "${pendingDirectMock.title}" with ${pendingDirectMock.questions.length} questions!`);
      setPendingDirectMock(null);
      setDirectMockTitle('');
      fetchInitialData();
    } catch (err: any) {
      setStatusMsg(`Publish Error: ${err.message}`);
    }
  }

  async function handleUpdateCutoff(testId: string, newCutoff: number) {
    setStatusMsg('Updating cut-off marks...');
    
    const { data, error } = await supabase
      .from('mock_tests')
      .update({ cutoff_marks: Number(newCutoff) })
      .eq('id', testId)
      .select();

    if (error) {
      console.error('Supabase Update Error:', error);
      setStatusMsg(`❌ Error updating cutoff: ${error.message}`);
      alert(`Update failed: ${error.message}`);
    } else {
      setStatusMsg(`✅ Successfully updated cut-off to ${newCutoff}!`);
      setEditingCutoffId(null);
      fetchInitialData();
    }
  }

  async function handleDeleteMockTest(testId: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    const { error } = await supabase.from('mock_tests').delete().eq('id', testId);
    if (!error) {
      setStatusMsg(`🗑️ Deleted "${title}".`);
      fetchInitialData();
    }
  }

  async function handleReplaceMockExcel(testId: string, testTitle: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Are you sure you want to replace questions for "${testTitle}" with this new Excel file?`)) {
      e.target.value = '';
      return;
    }

    setStatusMsg(`Processing replacement Excel for "${testTitle}"...`);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          setStatusMsg('⚠️ Replacement Excel file is empty!');
          return;
        }

        const formattedJSONQuestions = data.map((row, idx) => {
          let rawSec = String(row.section || row.Subject || row.SECTION || row.SUBJECT || '').trim().toUpperCase();
          let normSec = 'QUANT';

          if (rawSec.includes('ENG')) normSec = 'ENGLISH';
          else if (rawSec.includes('REASON')) normSec = 'REASONING';
          else if (rawSec.includes('QUANT') || rawSec.includes('MATH')) normSec = 'QUANT';
          else if (rawSec.includes('GA') || rawSec.includes('CURRENT') || rawSec.includes('AWARE') || rawSec.includes('GS')) normSec = 'GA';
          else if (rawSec.includes('HIN')) normSec = 'HINDI';

          const answerLetter = String(row.correctOptionIndex ?? row['Correct Answer'] ?? row.correctOption ?? '0').toUpperCase().trim();
          const optionMap: { [key: string]: number } = { A: 0, B: 1, C: 2, D: 3, E: 4, '0': 0, '1': 1, '2': 2, '3': 3, '4': 4 };
          const correctIdx = optionMap[answerLetter] !== undefined ? optionMap[answerLetter] : 0;

          const qText = String(
            row.questionText || row.question_text || row['Question Text'] || row.Question || row.statement || row.Text || row.question || `Question ${idx + 1}`
          ).trim();

          const pText = String(
            row.passageText || row.passage_text || row.passage || row.Direction || row.direction || row['Solution Text'] || ''
          ).trim();

          const explanationText = String(
            row.explanation || row.Explanation || row.Solution || row.solution || row.solution_text || ''
          ).trim();

          const options = [
            String(row.optionA || row['Option A'] || row.option_1 || row.option1 || row.A || row.choice1 || row.ChoiceA || '').trim(),
            String(row.optionB || row['Option B'] || row.option_2 || row.option2 || row.B || row.choice2 || row.ChoiceB || '').trim(),
            String(row.optionC || row['Option C'] || row.option_3 || row.option3 || row.C || row.choice3 || row.ChoiceC || '').trim(),
            String(row.optionD || row['Option D'] || row.option_4 || row.option4 || row.D || row.choice4 || row.ChoiceD || '').trim(),
            String(row.optionE || row['Option E'] || row.option_5 || row.option5 || row.E || row.choice5 || row.ChoiceE || '').trim(),
          ].filter(Boolean);

          return {
            id: `q-${idx + 1}-${Date.now()}`,
            section: normSec,
            passageText: pText,
            questionText: qText,
            options: options.length > 0 ? options : ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'],
            correctOptionIndex: correctIdx,
            marks: Number(row.marks ?? 1.0),
            negativeMarks: Number(row.negativeMarks ?? 0.25),
            explanation: explanationText,
          };
        });

        const cleanJsonPayload = JSON.parse(JSON.stringify(formattedJSONQuestions));

        const { error: updateErr } = await supabase
          .from('mock_tests')
          .update({ 
            questions: cleanJsonPayload,
            total_marks: formattedJSONQuestions.length * 1.0
          })
          .eq('id', testId);

        if (updateErr) throw updateErr;

        setStatusMsg(`🎉 Successfully replaced questions for "${testTitle}" with ${data.length} new questions!`);
        fetchInitialData();
      } catch (err: any) {
        setStatusMsg(`Replacement Error: ${err.message}`);
      } finally {
        e.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  }

  async function handleCreateQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!quizTitle.trim()) return setStatusMsg('⚠️ Enter Quiz Title!');

    setStatusMsg('Creating Quiz Container...');
    const { error } = await supabase.from('bsca_quizzes').insert([
      { title: quizTitle.trim(), quiz_date: quizDate, duration_minutes: Number(quizDuration) },
    ]);

    if (error) {
      setStatusMsg(`Quiz Creation Error: ${error.message}`);
    } else {
      setStatusMsg(`🎉 Created Quiz: "${quizTitle}"`);
      setQuizTitle('');
      fetchInitialData();
    }
  }

  async function handleAddQuizQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuizId) return setStatusMsg('⚠️ Select a Quiz container!');

    setStatusMsg('Adding Question to Quiz...');
    const { error } = await supabase.from('bsca_quiz_questions').insert([
      {
        quiz_id: selectedQuizId,
        question_text: quizQuestionText,
        options: quizOptions,
        correct_option_index: Number(quizCorrectOption),
        explanation: quizExplanation,
      },
    ]);

    if (error) {
      setStatusMsg(`Question Error: ${error.message}`);
    } else {
      setStatusMsg('✅ Added Question & Explanation to Quiz!');
      setQuizQuestionText('');
      setQuizOptions(['', '', '', '']);
      setQuizExplanation('');
      setQuizCorrectOption(0);
      fetchBscaQuizQuestions(selectedQuizId);
    }
  }

  async function handleDeleteQuiz(quizId: string, title: string) {
    if (!confirm(`Delete Quiz "${title}" and all its questions?`)) return;

    const { error } = await supabase.from('bsca_quizzes').delete().eq('id', quizId);
    if (!error) {
      setStatusMsg(`🗑️ Deleted Quiz "${title}".`);
      fetchInitialData();
    }
  }

  async function handleUpdateBscaQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!editingQuizQuestionId) return;

    setStatusMsg('Updating quiz question...');
    const { error } = await supabase
      .from('bsca_quiz_questions')
      .update({
        question_text: quizQuestionText,
        options: quizOptions,
        correct_option_index: Number(quizCorrectOption),
        explanation: quizExplanation,
      })
      .eq('id', editingQuizQuestionId);

    if (error) {
      setStatusMsg(`Update Error: ${error.message}`);
    } else {
      setStatusMsg('✅ Successfully updated quiz question!');
      setEditingQuizQuestionId(null);
      setQuizQuestionText('');
      setQuizOptions(['', '', '', '']);
      setQuizExplanation('');
      setQuizCorrectOption(0);
      if (selectedQuizId) fetchBscaQuizQuestions(selectedQuizId);
    }
  }

  function handleStartEditBscaQuestion(q: any) {
    setEditingQuizQuestionId(q.id);
    setQuizQuestionText(q.question_text);
    setQuizOptions(q.options || ['', '', '', '']);
    setQuizCorrectOption(q.correct_option_index || 0);
    setQuizExplanation(q.explanation || '');
  }

  async function handleDeleteBscaQuestion(qId: string) {
    if (!confirm('Delete this question from the quiz?')) return;
    const { error } = await supabase.from('bsca_quiz_questions').delete().eq('id', qId);
    if (!error) {
      setStatusMsg('🗑️ Deleted quiz question.');
      if (selectedQuizId) fetchBscaQuizQuestions(selectedQuizId);
    }
  }

  async function handleCreateCourseContainer(e: React.FormEvent) {
    e.preventDefault();
    if (!courseTitle.trim()) return setStatusMsg('⚠️ Please enter a Course Title!');

    setStatusMsg('Creating PDF Course Container...');
    const { error } = await supabase.from('pdf_courses').insert([
      {
        title: courseTitle.trim(),
        category: courseCategory,
        description: courseDesc,
      },
    ]);

    if (error) {
      setStatusMsg(`Course Creation Error: ${error.message}`);
    } else {
      setStatusMsg(`🎉 Created ${courseCategory} Course Container: "${courseTitle}"`);
      setCourseTitle('');
      setCourseDesc('');
      fetchInitialData();
    }
  }

  async function handlePdfUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCourseId) return setStatusMsg('⚠️ Please select a Course Container first!');
    if (!pdfFile) return setStatusMsg('⚠️ Please select a PDF file!');

    try {
      setStatusMsg('Uploading PDF to Supabase Storage...');
      const filePath = `pdfs/${Date.now()}_${pdfFile.name}`;

      const { error: uploadErr } = await supabase.storage.from('course_pdfs').upload(filePath, pdfFile);
      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage.from('course_pdfs').getPublicUrl(filePath);

      setStatusMsg('Saving Day-Wise PDF Record...');
      const { error: dbErr } = await supabase.from('course_pdfs').insert([
        {
          course_id: selectedCourseId,
          day_number: Number(dayNumber),
          title: pdfTitle || `Day ${dayNumber} PDF Sheet`,
          topic_list: topicList,
          pdf_url: publicUrlData.publicUrl,
        },
      ]);

      if (dbErr) throw dbErr;

      setStatusMsg(`🎉 Uploaded Day ${dayNumber} PDF successfully!`);
      setPdfTitle('');
      setTopicList('');
      setPdfFile(null);
      setDayNumber((prev) => prev + 1);
      fetchInitialData();
    } catch (err: any) {
      setStatusMsg(`Upload Error: ${err.message}`);
    }
  }

  async function handleDeleteCourse(courseId: string, title: string) {
    if (!confirm(`Delete entire course "${title}" and all its Day PDFs?`)) return;

    setStatusMsg('Deleting Course...');
    const { error } = await supabase.from('pdf_courses').delete().eq('id', courseId);

    if (error) {
      setStatusMsg(`Delete Error: ${error.message}`);
    } else {
      setStatusMsg(`🗑️ Deleted Course "${title}".`);
      fetchInitialData();
    }
  }

  async function handleDeletePdf(pdfId: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    setStatusMsg('Deleting Day PDF...');
    const { error } = await supabase.from('course_pdfs').delete().eq('id', pdfId);

    if (error) {
      setStatusMsg(`Delete Error: ${error.message}`);
    } else {
      setStatusMsg(`🗑️ Deleted "${title}" successfully.`);
      fetchInitialData();
    }
  }

  async function handleReplacePdf(pdfId: string, pdfTitleName: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Replace PDF file for "${pdfTitleName}"?`)) {
      e.target.value = '';
      return;
    }

    setStatusMsg(`Uploading new PDF for "${pdfTitleName}"...`);
    try {
      const filePath = `pdfs/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('course_pdfs').upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage.from('course_pdfs').getPublicUrl(filePath);

      const { error: dbErr } = await supabase
        .from('course_pdfs')
        .update({ pdf_url: publicUrlData.publicUrl })
        .eq('id', pdfId);

      if (dbErr) throw dbErr;

      setStatusMsg(`🎉 Successfully replaced PDF for "${pdfTitleName}"!`);
      fetchInitialData();
    } catch (err: any) {
      setStatusMsg(`PDF Replacement Error: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  }

  async function handleSaveNewExamCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!parentExamName.trim()) return setStatusMsg('⚠️ Please enter Parent Exam Name!');

    const formattedFullName = `${parentExamName.trim()} - ${subCategoryType}`;

    setStatusMsg('Saving hierarchical exam category...');
    const { error } = await supabase.from('exam_categories').insert([
      {
        exam_name: formattedFullName,
        sub_category: subCategoryType,
        total_duration_minutes: Number(newExamDuration),
        sections: examSections,
      },
    ]);

    if (error) {
      setStatusMsg(`Error creating exam category: ${error.message}`);
    } else {
      setStatusMsg(`🎉 Successfully created "${formattedFullName}"!`);
      fetchInitialData();
    }
  }

  async function handleDeleteExamCategory(id: string, name: string) {
    if (!confirm(`Delete exam category "${name}"?`)) return;
    const { error } = await supabase.from('exam_categories').delete().eq('id', id);
    if (!error) {
      setStatusMsg(`🗑️ Deleted category "${name}".`);
      fetchInitialData();
    }
  }

  async function handleMockFromQuestionBankSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mockTitle.trim()) return setStatusMsg('⚠️ Please enter a Mock Test Title!');
    if (selectedQuestionIds.length === 0) return setStatusMsg('⚠️ Please select at least 1 question!');

    setStatusMsg('Building Mock Test from selected questions...');

    const selectedQuestionObjects = allQuestions.filter((q) => selectedQuestionIds.includes(q.id));

    const compiledJSONQuestions = selectedQuestionObjects.map((q, idx) => {
      let subjectName = (q.subjects?.name || 'QUANT').toUpperCase();
      let normSec = 'QUANT';

      if (subjectName.includes('ENG')) normSec = 'ENGLISH';
      else if (subjectName.includes('REASON')) normSec = 'REASONING';
      else if (subjectName.includes('QUANT') || subjectName.includes('MATH')) normSec = 'QUANT';
      else if (subjectName.includes('GA') || subjectName.includes('CURRENT') || subjectName.includes('AWARE')) normSec = 'GA';
      else if (subjectName.includes('HIN')) normSec = 'HINDI';

      return {
        id: q.id || `q-${idx + 1}-${Date.now()}`,
        section: normSec,
        passageText: q.solution_text || '',
        questionText: q.question_text || `Question ${idx + 1}`,
        options: q.options && q.options.length > 0 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'],
        correctOptionIndex: Number(q.correct_option_index ?? 0),
        marks: 1.0,
        negativeMarks: 0.25,
      };
    });

    const payload = {
      title: mockTitle.trim(),
      exam_type: mockExamType,
      sub_category_id: mockSubCategoryId || null,
      duration_minutes: Number(mockDuration),
      total_marks: Number(mockMarks),
      questions: compiledJSONQuestions,
      is_published: true,
      created_at: new Date().toISOString(),
    };

    const { data: testData, error: testError } = await supabase.from('mock_tests').insert([payload]).select();

    if (testError || !testData) {
      setStatusMsg(`Error creating test: ${testError?.message}`);
      return;
    }

    setStatusMsg(`✅ Published "${mockTitle}" with ${selectedQuestionIds.length} questions!`);
    setMockTitle('');
    setSelectedQuestionIds([]);
    fetchInitialData();
  }

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
      setStatusMsg('✅ Question added to Question Bank!');
      setQuestionText('');
      setOptions(['', '', '', '', '']);
      setSolutionText('');
      setCorrectOptionIndex(0);
      fetchInitialData();
    }
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedSubject) {
      setStatusMsg('⚠️ Please select a target subject first!');
      return;
    }

    setStatusMsg('Reading Excel file...');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          setStatusMsg('⚠️ Excel file is empty!');
          return;
        }

        setStatusMsg(`Uploading ${data.length} questions to Question Bank...`);

        const formattedQuestions = data.map((row) => {
          const answerLetter = String(row['Correct Answer'] || row.correctOptionIndex || 'A').toUpperCase().trim();
          const optionMap: { [key: string]: number } = { A: 0, B: 1, C: 2, D: 3, E: 4, '0': 0, '1': 1, '2': 2, '3': 3, '4': 4 };
          const correctIdx = optionMap[answerLetter] !== undefined ? optionMap[answerLetter] : 0;

          return {
            subject_id: selectedSubject,
            question_text: String(row['Question Text'] || row.questionText || row.question || ''),
            options: [
              String(row['Option A'] || row.optionA || row.option1 || ''),
              String(row['Option B'] || row.optionB || row.option2 || ''),
              String(row['Option C'] || row.optionC || row.option3 || ''),
              String(row['Option D'] || row.optionD || row.option4 || ''),
              String(row['Option E'] || row.optionE || row.option5 || ''),
            ].filter(Boolean),
            correct_option_index: correctIdx,
            solution_text: String(row['Solution Text'] || row.passageText || ''),
          };
        });

        const { error } = await supabase.from('questions').insert(formattedQuestions);

        if (error) {
          setStatusMsg(`Bulk Upload Error: ${error.message}`);
        } else {
          setStatusMsg(`🎉 Imported ${data.length} questions into Question Bank!`);
          fetchInitialData();
        }
      } catch (err: any) {
        setStatusMsg(`File Error: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(file);
  };

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

  const isAllFilteredSelected = filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedQuestionIds.includes(q.id));

  const handleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredQuestions.map((q) => q.id));
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => !filteredIds.has(id)));
    } else {
      const filteredIds = filteredQuestions.map((q) => q.id);
      const combined = Array.from(new Set([...selectedQuestionIds, ...filteredIds]));
      setSelectedQuestionIds(combined);
    }
  };

  async function handleDeleteSelectedQuestions() {
    if (selectedQuestionIds.length === 0) return;
    if (!confirm(`Delete ${selectedQuestionIds.length} question(s) permanently?`)) return;

    setStatusMsg(`Deleting ${selectedQuestionIds.length} question(s)...`);
    const { error } = await supabase.from('questions').delete().in('id', selectedQuestionIds);

    if (!error) {
      setStatusMsg(`🗑️ Deleted ${selectedQuestionIds.length} question(s).`);
      setSelectedQuestionIds([]);
      fetchInitialData();
    }
  }

  async function fetchDaySpecificData(day: number, mode: string) {
    const { data: checklistData } = await supabase
      .from('admin_day_checklist_items')
      .select('*')
      .eq('day_number', day)
      .eq('track_mode', mode)
      .order('display_order', { ascending: true });

    if (checklistData) {
      setDayChecklistItems(checklistData);
    } else {
      setDayChecklistItems([]);
    }

    const { data: videoData } = await supabase
      .from('admin_targets_config')
      .select('youtube_url')
      .eq('day_number', day)
      .eq('track_mode', mode)
      .single();

    if (videoData) {
      setTargetVideoUrl(videoData.youtube_url || '');
    } else {
      setTargetVideoUrl('');
    }
  }

  async function handleCopyVideoFromPreviousDay() {
    if (targetDayNo <= 1) {
      return setStatusMsg('⚠️ This is Day 1; there is no previous day to copy from!');
    }

    const prevDay = targetDayNo - 1;
    const foundPrev = allConfiguredTargets.find(
      (t) => t.day_number === prevDay && t.track_mode === targetTrackMode
    );

    if (foundPrev && foundPrev.youtube_url) {
      setTargetVideoUrl(foundPrev.youtube_url);
      setStatusMsg(`📋 Copied video URL from Day ${prevDay} (${targetTrackMode})! Click Save to confirm.`);
    } else {
      setStatusMsg(`⚠️ No video found for Day ${prevDay} under ${targetTrackMode} track.`);
    }
  }

  async function handleSaveTargetConfig(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg('Saving Day Target Configuration...');

    const { error } = await supabase.from('admin_targets_config').upsert([
      { 
        day_number: Number(targetDayNo), 
        track_mode: targetTrackMode, 
        youtube_url: targetVideoUrl.trim() 
      }
    ], { onConflict: 'day_number,track_mode' });

    if (error) {
      setStatusMsg(`Error saving target: ${error.message}`);
    } else {
      setStatusMsg(`✅ Successfully updated Day ${targetDayNo} (${targetTrackMode.toUpperCase()}) YouTube video!`);
      fetchInitialData();
    }
  }

  async function handleCopyChecklistFromPreviousDay() {
    if (targetDayNo <= 1) {
      return setStatusMsg('⚠️ This is Day 1; there is no previous day to copy from!');
    }

    const prevDay = targetDayNo - 1;
    setStatusMsg(`Fetching checklist items from Day ${prevDay} (${targetTrackMode})...`);

    const { data: prevItems, error: fetchErr } = await supabase
      .from('admin_day_checklist_items')
      .select('label, display_order')
      .eq('day_number', prevDay)
      .eq('track_mode', targetTrackMode)
      .order('display_order', { ascending: true });

    if (fetchErr || !prevItems || prevItems.length === 0) {
      return setStatusMsg(`⚠️ No checklist items found for Day ${prevDay} under ${targetTrackMode} track.`);
    }

    const newItemsToInsert = prevItems.map((item, idx) => ({
      day_number: Number(targetDayNo),
      track_mode: targetTrackMode,
      label: item.label,
      display_order: dayChecklistItems.length + idx + 1,
    }));

    const { error: insertErr } = await supabase
      .from('admin_day_checklist_items')
      .insert(newItemsToInsert);

    if (insertErr) {
      setStatusMsg(`Error copying checklist: ${insertErr.message}`);
    } else {
      setStatusMsg(`📋 Successfully copied ${prevItems.length} checklist items from Day ${prevDay} to Day ${targetDayNo}!`);
      fetchDaySpecificData(targetDayNo, targetTrackMode);
    }
  }

  async function handleAddDayChecklistItem(e: React.FormEvent) {
    e.preventDefault();
    if (!dayChecklistInput.trim()) return setStatusMsg('⚠️ Enter checklist label!');

    setStatusMsg(`Adding checklist item for Day ${targetDayNo}...`);

    const { error } = await supabase.from('admin_day_checklist_items').insert([
      { 
        day_number: Number(targetDayNo), 
        track_mode: targetTrackMode, 
        label: dayChecklistInput.trim(), 
        display_order: dayChecklistItems.length + 1 
      }
    ]);

    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setStatusMsg(`✅ Added item to Day ${targetDayNo} (${targetTrackMode}) checklist!`);
      setDayChecklistInput('');
      fetchDaySpecificData(targetDayNo, targetTrackMode);
    }
  }

  async function handleDeleteDayChecklistItem(id: string, label: string) {
    if (!confirm(`Delete "${label}" from Day ${targetDayNo} checklist?`)) return;
    const { error } = await supabase.from('admin_day_checklist_items').delete().eq('id', id);
    if (!error) {
      setStatusMsg('🗑️ Deleted item.');
      fetchDaySpecificData(targetDayNo, targetTrackMode);
    }
  }

  async function handleAddMarqueeNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!marqueeInput.trim()) return setStatusMsg('⚠️ Please enter notice text!');

    setStatusMsg('Adding marquee notice...');
    const { error } = await supabase.from('admin_marquee_notices').insert([
      { notice_text: marqueeInput.trim(), display_order: adminMarqueeList.length + 1 }
    ]);

    if (error) {
      setStatusMsg(`Error adding notice: ${error.message}`);
    } else {
      setStatusMsg('✅ Marquee notice published successfully!');
      setMarqueeInput('');
      fetchInitialData();
    }
  }

  async function handleDeleteMarqueeNotice(id: string) {
    if (!confirm('Delete this marquee notice?')) return;
    const { error } = await supabase.from('admin_marquee_notices').delete().eq('id', id);
    if (!error) {
      setStatusMsg('🗑️ Marquee notice deleted.');
      fetchInitialData();
    }
  }

  async function handleAddExamCountdown(e: React.FormEvent) {
    e.preventDefault();
    if (!examNameInput.trim() || !examDateInput) return setStatusMsg('⚠️ Enter exam name and date!');

    setStatusMsg('Adding Exam Countdown...');
    const { error } = await supabase.from('admin_exam_countdowns').insert([
      { exam_name: examNameInput.trim(), exam_date: examDateInput }
    ]);

    if (error) {
      setStatusMsg(`Error adding exam: ${error.message}`);
    } else {
      setStatusMsg(`🎉 Added countdown for "${examNameInput}"!`);
      setExamNameInput('');
      setExamDateInput('');
      fetchInitialData();
    }
  }

  async function handleDeleteExamCountdown(id: string, name: string) {
    if (!confirm(`Delete countdown for "${name}"?`)) return;
    const { error } = await supabase.from('admin_exam_countdowns').delete().eq('id', id);
    if (!error) {
      setStatusMsg(`🗑️ Deleted countdown.`);
      fetchInitialData();
    }
  }

  async function handlePublishPost(e: React.FormEvent) {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) return setStatusMsg('⚠️ Please enter Title and Content!');

    setStatusMsg('Publishing update...');
    let finalImageUrl = postImageUrl.trim();

    if (imageFile) {
      try {
        const filePath = `updates/${Date.now()}_${imageFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('course_pdfs').upload(filePath, imageFile);
        if (!uploadErr) {
          const { data: publicUrlData } = supabase.storage.from('course_pdfs').getPublicUrl(filePath);
          finalImageUrl = publicUrlData.publicUrl;
        }
      } catch (err) {
        console.error('Image Upload Error:', err);
      }
    }

    const { error } = await supabase.from('updates_feed').insert([
      {
        category: postCategory,
        title: postTitle.trim(),
        content: postContent,
        exam_tag: postExamTag,
        is_pinned: postIsPinned,
        post_date: postDate,
        image_url: finalImageUrl || null,
        external_link: postExternalLink.trim() || null,
      },
    ]);

    if (error) {
      setStatusMsg(`Publish Error: ${error.message}`);
    } else {
      setStatusMsg(`🎉 Published ${postCategory}: "${postTitle}"`);
      setPostTitle('');
      setPostContent('');
      setPostImageUrl('');
      setPostExternalLink('');
      setImageFile(null);
      setPostIsPinned(false);
      fetchInitialData();
    }
  }

  async function handleDeletePost(postId: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    const { error } = await supabase.from('updates_feed').delete().eq('id', postId);
    if (!error) {
      setStatusMsg(`🗑️ Deleted update.`);
      fetchInitialData();
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold">
        Verifying Admin Credentials...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl flex items-center justify-center text-2xl mx-auto">
              🔒
            </div>
            <h1 className="text-xl font-bold text-white">Admin Login Required</h1>
            <p className="text-xs text-slate-400">
              This portal is restricted to BankingSolutions admins only.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-bold">
                {authError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Admin Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="admin@bankingsolutions.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Password</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg transition"
            >
              Sign In as Admin
            </button>
          </form>

          <div className="text-center pt-2">
            <Link href="/" className="text-xs text-slate-400 hover:text-white transition">
              ← Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 font-sans text-slate-900 bg-slate-50 min-h-screen space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">BankingSolutions Admin Portal</h1>
          <p className="text-xs text-slate-500">Manage Sub-Cards, Quizzes, Excel Mocks, BSPS & BSCA PDFs</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs flex-wrap gap-y-1">
            <button
              onClick={() => setActiveTab('updates_publisher')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'updates_publisher' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📢 Updates
            </button>
            <button
              onClick={() => setActiveTab('sub_cards_manager')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'sub_cards_manager' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗂️ Exam Sub-Cards
            </button>
            <button
              onClick={() => setActiveTab('bsca_quiz_builder')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'bsca_quiz_builder' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💡 BSCA Quiz
            </button>
            <button
              onClick={() => setActiveTab('pdf_uploader')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'pdf_uploader' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📄 BSPS / BSCA PDFs
            </button>
            <button
              onClick={() => setActiveTab('direct_mock_upload')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'direct_mock_upload' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🚀 Direct Mock
            </button>
            <button
              onClick={() => setActiveTab('create_exam_tab')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'create_exam_tab' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚙️ Create Exam Cat
            </button>
            <button
              onClick={() => setActiveTab('create_mock')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'create_mock' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📋 Build from Bank
            </button>
            <button
              onClick={() => setActiveTab('add_question')}
              className={`px-3 py-1.5 font-semibold rounded-md transition ${
                activeTab === 'add_question' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Question
            </button>
            <button
              onClick={() => setActiveTab('bulk_upload')}
              className={`px-3 py-1.5 font-semibold rounded-md transition ${
                activeTab === 'bulk_upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📥 Excel Bank
            </button>
            <button
              onClick={() => setActiveTab('targets_manager')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'targets_manager' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎯 Daily Targets
            </button>
            <button
              onClick={() => {
                setActiveTab('mock_analytics');
                if (existingMocks.length > 0 && !selectedAnalyticsMockId) {
                  setSelectedAnalyticsMockId(existingMocks[0].id);
                  fetchMockAnalytics(existingMocks[0].id);
                }
              }}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'mock_analytics' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Stats
            </button>
            <button
              onClick={() => setActiveTab('computer_quiz')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'computer_quiz' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💻 Computer Builder
            </button>
            <button
              onClick={() => setActiveTab('ebook_manager')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'ebook_manager' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📖 E-Book Manager
            </button>
            <Link
              href="/admin/computer-quiz"
              className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 text-slate-700 hover:text-blue-600 hover:bg-slate-100"
            >
              <span>💻</span> Quiz
            </Link>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-sm font-semibold">
          {statusMsg}
        </div>
      )}

      {/* EXAM SUB-CARDS MANAGER TAB */}
      {activeTab === 'sub_cards_manager' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateSubCategory} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b pb-2">🗂️ Create Sub-Card / Sub-Exam (e.g. IBPS PO → Prelims 2026 Test Series)</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Parent Exam Name</label>
                <select
                  value={subCardParentExam}
                  onChange={(e) => setSubCardParentExam(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold"
                >
                  <option value="IBPS PO">IBPS PO</option>
                  <option value="SBI PO">SBI PO</option>
                  <option value="IBPS CLERK">IBPS CLERK</option>
                  <option value="SBI CLERK">SBI CLERK</option>
                  <option value="IBPS RRB PO">IBPS RRB PO</option>
                  <option value="IBPS RRB CLERK">IBPS RRB CLERK</option>
                  <option value="RBI Grade B">RBI Grade B</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Sub-Card Title</label>
                <input
                  type="text"
                  value={subCardTitleInput}
                  onChange={(e) => setSubCardTitleInput(e.target.value)}
                  placeholder="e.g. Prelims 2026 Test Series"
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Description (Optional)</label>
              <input
                type="text"
                value={subCardDescInput}
                onChange={(e) => setSubCardDescInput(e.target.value)}
                placeholder="e.g. Full-length mocks based on latest IBPS PO pattern"
                className="w-full border p-2.5 rounded-lg text-sm bg-white"
              />
            </div>

            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow">
              Create Sub-Card ➕
            </button>
          </form>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Active Sub-Cards ({subCategories.length})</h3>
            {subCategories.length === 0 ? (
              <p className="text-xs text-slate-500">No sub-cards created yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {subCategories.map((sc) => (
                  <div key={sc.id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-2">{sc.parent_exam_name}</span>
                      <span className="font-bold text-slate-800">{sc.sub_card_title}</span>
                      {sc.description && <p className="text-slate-400 text-[11px] mt-0.5">{sc.description}</p>}
                    </div>

                    <button
                      onClick={() => handleDeleteSubCategory(sc.id, sc.sub_card_title)}
                      className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-3 py-1 rounded-lg transition"
                    >
                      Delete Sub-Card 🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DIRECT EXCEL MOCK UPLOAD TAB */}
      {activeTab === 'direct_mock_upload' && (
        <div className="bg-white shadow-sm rounded-xl p-6 border border-slate-200 space-y-6">
          <div className="flex items-center space-x-2 border-b pb-3">
            <h2 className="text-lg font-bold text-slate-800">1-Click Direct Mock Upload (Excel .xlsx with Image Support)</h2>
          </div>

          {!pendingDirectMock ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mock Test Title</label>
                  <input
                    type="text"
                    value={directMockTitle}
                    onChange={(e) => setDirectMockTitle(e.target.value)}
                    placeholder="e.g. IBPS PO Prelims - Mock 01"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Link to Exam Sub-Card</label>
                  <select
                    value={directMockSubCategoryId}
                    onChange={(e) => setDirectMockSubCategoryId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-xs bg-white font-bold"
                  >
                    <option value="">-- Select Target Sub-Card --</option>
                    {subCategories.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        [{sc.parent_exam_name}] {sc.sub_card_title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Category Tag / Exam Type</label>
                  <select
                    value={directMockExamType}
                    onChange={(e) => setDirectMockExamType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white font-semibold"
                  >
                    <option value="SBI PO Prelims">SBI PO Prelims</option>
                    <option value="IBPS PO Prelims">IBPS PO Prelims</option>
                    <option value="BSCA">BSCA (Current Affairs Quiz)</option>
                    <option value="BSPS">BSPS (Practice Sheet Quiz)</option>
                    {dynamicExamsList.map((ex) => (
                      <option key={ex.id} value={ex.exam_name}>{ex.exam_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={directMockDuration}
                    onChange={(e) => setDirectMockDuration(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Total Marks</label>
                  <input
                    type="number"
                    value={directMockMarks}
                    onChange={(e) => setDirectMockMarks(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target Cut-Off</label>
                  <input
                    type="number"
                    value={directMockCutoff}
                    onChange={(e) => setDirectMockCutoff(Number(e.target.value))}
                    placeholder="e.g. 58"
                    className="w-full border border-amber-300 bg-amber-50 rounded-lg p-2.5 text-slate-900 text-sm font-bold"
                    required
                  />
                </div>
              </div>

              <div className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl p-8 text-center bg-blue-50/40 transition cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleDirectMockUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-blue-900 space-y-2">
                  <span className="text-4xl block">📊</span>
                  <p className="font-bold text-sm text-[#1D63B8]">Click to upload Excel Mock File (.xlsx)</p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl space-y-4">
              <h3 className="text-lg font-bold text-emerald-900 border-b border-emerald-200 pb-2">Preview & Publish</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-emerald-900">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-emerald-600 mb-1">Title</span>
                  <b className="block truncate">{pendingDirectMock.title}</b>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-emerald-600 mb-1">Total Marks</span>
                  <b>{pendingDirectMock.total_marks} Marks</b>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-emerald-600 mb-1">Questions Parsed</span>
                  <b>{pendingDirectMock.questions.length} Qs</b>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-emerald-600 mb-1">Target Cut-off</span>
                  <b>{pendingDirectMock.cutoff_marks} Marks</b>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-emerald-200">
                <button
                  onClick={handlePublishPendingMock}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  🚀 Publish Mock Test Now
                </button>
                <button
                  onClick={() => {
                    setPendingDirectMock(null);
                    setStatusMsg('Upload cancelled.');
                  }}
                  className="px-6 py-3 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs rounded-xl transition"
                >
                  Cancel & Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BUILD MOCK FROM QUESTION BANK TAB */}
      {activeTab === 'create_mock' && (
        <div className="space-y-6">
          <form onSubmit={handleMockFromQuestionBankSubmit} className="bg-white shadow-sm rounded-xl p-6 border border-slate-200 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-3">Build Mock Test from Question Bank</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mock Test Title</label>
                <input
                  type="text"
                  value={mockTitle}
                  onChange={(e) => setMockTitle(e.target.value)}
                  placeholder="e.g. SBI PO Prelims - Mock 01"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Link to Exam Sub-Card</label>
                <select
                  value={mockSubCategoryId}
                  onChange={(e) => setMockSubCategoryId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-xs bg-white font-bold"
                >
                  <option value="">-- Select Target Sub-Card --</option>
                  {subCategories.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      [{sc.parent_exam_name}] {sc.sub_card_title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Category / Exam Type Tag</label>
                <select
                  value={mockExamType}
                  onChange={(e) => setMockExamType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white font-semibold"
                >
                  <option value="SBI PO Prelims">SBI PO Prelims</option>
                  <option value="IBPS PO Prelims">IBPS PO Prelims</option>
                  <option value="BSCA">BSCA (Current Affairs Quiz)</option>
                  <option value="BSPS">BSPS (Practice Sheet Quiz)</option>
                  {dynamicExamsList.map((ex) => (
                    <option key={ex.id} value={ex.exam_name}>{ex.exam_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Duration (Mins)</label>
                <input
                  type="number"
                  value={mockDuration}
                  onChange={(e) => setMockDuration(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Total Marks</label>
                <input
                  type="number"
                  value={mockMarks}
                  onChange={(e) => setMockMarks(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <label className="block text-sm font-bold text-slate-800">Select Questions from Bank</label>
                  <p className="text-xs text-slate-500">
                    Selected for this mock: <span className="font-bold text-[#1D63B8]">{selectedQuestionIds.length} Questions</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    {isAllFilteredSelected ? 'Deselect Filtered' : 'Select All Filtered'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedQuestions}
                    disabled={selectedQuestionIds.length === 0}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                      selectedQuestionIds.length > 0
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Delete Selected ({selectedQuestionIds.length}) 🗑️
                  </button>
                </div>
              </div>

              <select
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 bg-white text-xs font-bold"
              >
                <option value="ALL">All Subjects ({allQuestions.length} Questions Available)</option>
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

            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white p-2">
              {filteredQuestions.length === 0 ? (
                <p className="text-xs text-slate-500 p-6 text-center">No questions in Question Bank yet.</p>
              ) : (
                filteredQuestions.map((q) => {
                  const isSelected = selectedQuestionIds.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleQuestionSelection(q.id)}
                      className={`p-3 rounded-lg transition flex items-start space-x-3 text-xs cursor-pointer ${
                        isSelected ? 'bg-blue-50 border border-blue-200 font-medium' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-blue-600"
                      />
                      <div>
                        <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded mr-2">
                          {q.subjects?.name || 'Subject'}
                        </span>
                        <span className="text-slate-800">{q.question_text}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="submit"
              disabled={selectedQuestionIds.length === 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-xl transition shadow text-xs"
            >
              Publish Selected {selectedQuestionIds.length} Questions as Mock Test
            </button>
          </form>
        </div>
      )}

      {/* E-BOOK MANAGER TAB */}
      {activeTab === 'ebook_manager' && (
        <div className="space-y-6">
          <form onSubmit={handleUploadEBook} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b pb-2">📖 Publish New E-Book to Supabase</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">E-Book Title</label>
                <input
                  type="text"
                  value={eBookTitle}
                  onChange={(e) => setEBookTitle(e.target.value)}
                  placeholder="e.g. Complete Banking GA E-Book 2026"
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Author / Publisher</label>
                <input
                  type="text"
                  value={eBookAuthor}
                  onChange={(e) => setEBookAuthor(e.target.value)}
                  placeholder="e.g. BankingSolutions Team"
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Price (₹)</label>
                <input
                  type="number"
                  value={eBookPrice}
                  onChange={(e) => setEBookPrice(Number(e.target.value))}
                  placeholder="199"
                  className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Description</label>
                <input
                  type="text"
                  value={eBookDesc}
                  onChange={(e) => setEBookDesc(e.target.value)}
                  placeholder="Short description of the e-book contents..."
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Select PDF File (.pdf)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setEBookFile(e.target.files?.[0] || null)}
                  className="w-full border p-2 rounded-lg text-xs bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Select Cover Image (Image)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEBookCover(e.target.files?.[0] || null)}
                  className="w-full border p-2 rounded-lg text-xs bg-white"
                  required
                />
              </div>
            </div>

            <button type="submit" className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow">
              Upload and Publish E-Book 📚
            </button>
          </form>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Published E-Books Library ({allEBooks.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allEBooks.length === 0 ? (
                <p className="text-xs text-slate-500">No e-books uploaded yet.</p>
              ) : (
                allEBooks.map((book) => (
                  <div key={book.id} className="border rounded-xl p-4 flex gap-4 items-center bg-slate-50">
                    {book.cover_url && (
                      <img src={book.cover_url} alt={book.title} className="w-16 h-20 object-cover rounded-lg border shadow-sm" />
                    )}
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">₹{book.price}</span>
                      <h4 className="font-bold text-slate-800 text-sm">{book.title}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{book.description}</p>
                      <button
                        onClick={() => handleDeleteEBook(book.id, book.title)}
                        className="text-xs text-rose-600 font-bold hover:underline pt-1 block"
                      >
                        Delete E-Book 🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* COMPUTER AWARENESS CHAPTER BUILDER TAB */}
      {activeTab === 'computer_quiz' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b pb-2">⚡ Launch Offer Countdown Timer Control</h2>
            <p className="text-xs text-slate-500">Set the exact date and time when the ₹50 discount offer expires for students.</p>
            
            <form onSubmit={handleSaveTimer} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="w-full sm:w-auto flex-1 space-y-1">
                <label className="text-xs font-bold uppercase text-slate-500">Offer Expiry Date & Time</label>
                <input
                  type="datetime-local"
                  value={launchOfferEnd}
                  onChange={(e) => setLaunchOfferEnd(e.target.value)}
                  required
                  className="w-full border p-2.5 rounded-lg text-sm bg-white font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={savingTimer}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition"
              >
                {savingTimer ? 'Saving...' : 'Update Timer'}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form onSubmit={handleSaveComputerChapter} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 border-b pb-2">Add / Edit Computer Awareness Chapter</h2>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Chapter Number</label>
                <input
                  type="number"
                  value={compChapterNo}
                  onChange={(e) => setCompChapterNo(Number(e.target.value))}
                  className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Chapter Title</label>
                <input
                  type="text"
                  value={compTitle}
                  onChange={(e) => setCompTitle(e.target.value)}
                  placeholder="e.g. Introduction to Computers"
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Chapter MCQ PDF URL (Optional)</label>
                <input
                  type="url"
                  value={compPdfUrl}
                  onChange={(e) => setCompPdfUrl(e.target.value)}
                  placeholder="https://your-supabase-storage-url/mcqs.pdf"
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                />
              </div>
              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="isLockedCheck"
                  checked={isLocked}
                  onChange={(e) => setIsLocked(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <label htmlFor="isLockedCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  🔒 Lock this chapter (Requires purchase; uncheck for free demo)
                </label>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Content (Markdown Supported)</label>
                <textarea
                  rows={10}
                  value={compMarkdown}
                  onChange={(e) => setCompMarkdown(e.target.value)}
                  placeholder="Write chapter content using Markdown (headings, tables, lists)..."
                  className="w-full border p-2.5 rounded-lg text-xs font-mono bg-white"
                  required
                />
              </div>
              <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow">
                Save Chapter to Supabase 🚀
              </button>
            </form>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 border-b pb-2">Live Markdown Preview</h2>
              <div className="prose prose-sm max-w-none max-h-[450px] overflow-y-auto p-4 bg-slate-50 rounded-lg border">
                <h2 className="font-bold text-slate-900">{compTitle || 'Chapter Title Preview'}</h2>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{compMarkdown || '_Start typing markdown to preview..._'}</ReactMarkdown>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Existing Computer Chapters ({compChapters.length})</h3>
            <div className="space-y-2">
              {compChapters.map((ch) => (
                <div key={ch.id} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Ch {ch.chapter_number}</span>
                    <span className="text-xs font-bold text-slate-800">{ch.title}</span>
                    {ch.is_locked ? <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">🔒 Locked</span> : <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">🔓 Free</span>}
                    {ch.pdf_mcq_url && <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">📄 MCQ PDF</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setCompChapterNo(ch.chapter_number);
                        setCompTitle(ch.title);
                        setCompMarkdown(ch.markdown_content);
                        setIsLocked(ch.is_locked);
                        setCompPdfUrl(ch.pdf_mcq_url || '');
                      }}
                      className="px-3 py-1 bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition"
                    >
                      Edit ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteComputerChapter(ch.id)}
                      className="px-3 py-1 bg-rose-100 text-rose-700 font-bold text-xs rounded-lg transition"
                    >
                      Delete 🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* UPDATES PUBLISHER TAB */}
      {activeTab === 'updates_publisher' && (
        <div className="space-y-6">
          <form onSubmit={handlePublishPost} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b pb-2">Publish One-Liner or Exam Update</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Update Category</label>
                <select value={postCategory} onChange={(e: any) => setPostCategory(e.target.value)} className="w-full border p-2.5 rounded-lg text-xs bg-white font-bold">
                  <option value="ONE_LINER">📌 CA One-Liner</option>
                  <option value="NOTIFICATION">📢 Exam Notification</option>
                  <option value="EXPECTED_CUTOFF">🎯 Expected Cut-Off</option>
                  <option value="EXAM_ANALYSIS">📊 Shift Exam Analysis</option>
                  <option value="RESULT">🏆 Exam Result Out</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target Exam Tag</label>
                <select value={postExamTag} onChange={(e) => setPostExamTag(e.target.value)} className="w-full border p-2.5 rounded-lg text-xs bg-white font-bold">
                  <option value="SBI PO">SBI PO</option>
                  <option value="SBI CLERK">SBI CLERK</option>
                  <option value="IBPS PO">IBPS PO</option>
                  <option value="IBPS CLERK">IBPS CLERK</option>
                  <option value="IBPS RRB PO">IBPS RRB PO</option>
                  <option value="IBPS RRB CLERK">IBPS RRB CLERK</option>
                  <option value="RBI Grade B">RBI Grade B / Assistant</option>
                  <option value="General">General / All Exams</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target Date</label>
                <input
                  type="date"
                  value={postDate}
                  onChange={(e) => setPostDate(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-xs bg-white font-bold text-slate-800"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Attach Banner / Cut-Off Image File
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full border p-2 rounded-lg text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Official PDF / Notification Link URL
                </label>
                <input
                  type="url"
                  value={postExternalLink}
                  onChange={(e) => setPostExternalLink(e.target.value)}
                  placeholder="https://sbi.co.in/careers/notification.pdf"
                  className="w-full border p-2.5 rounded-lg text-xs bg-white"
                />
              </div>
            </div>

            <div className="flex items-center pt-2">
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={postIsPinned} onChange={(e) => setPostIsPinned(e.target.checked)} className="rounded text-blue-600" />
                <span>Pin to Top of Student Feed</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Update Title</label>
              <input type="text" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="e.g. SBI PO Prelims Today Shift 1 Analysis - Quantitative Aptitude Moderate" className="w-full border p-2.5 rounded-lg text-sm bg-white" required />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Content / One-Liners or Markdown Table (Use | for table columns)
              </label>
              <textarea
                rows={6}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder={"• World Bank boosts India's GDP growth forecast to 7.0% for FY26.\n\n| Section | Good Attempts | Difficulty |\n| Quant | 18 - 22 | Moderate |\n| Reasoning | 22 - 25 | Easy-Mod |"}
                className="w-full border p-2.5 rounded-lg text-xs font-mono bg-white"
                required
              />
            </div>

            <button type="submit" className="w-full py-3 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow">
              Publish Update to Live Feed
            </button>
          </form>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-slate-800">Manage Live Updates Feed ({publishedFeed.length})</h2>
              <Link href="/updates" className="text-xs font-bold text-blue-600 hover:underline">View Live Feed Page →</Link>
            </div>

            <div className="divide-y divide-slate-100">
              {publishedFeed.length === 0 ? (
                <p className="text-xs text-slate-500 p-2">No updates published yet.</p>
              ) : (
                publishedFeed.map((post) => (
                  <div key={post.id} className="py-3 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{post.category}</span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{post.exam_tag}</span>
                        <h3 className="font-bold text-slate-800 text-sm">{post.title}</h3>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{post.content}</p>
                    </div>

                    <button onClick={() => handleDeletePost(post.id, post.title)} className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs px-3 py-1 rounded-lg transition flex-shrink-0">
                      Delete 🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* BSCA QUIZ BUILDER TAB */}
      {activeTab === 'bsca_quiz_builder' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form onSubmit={handleCreateQuiz} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 border-b pb-2">Step 1: Create Daily Quiz Container</h2>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Quiz Title</label>
                <input
                  type="text"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  placeholder="e.g. BSCA Daily GA Quiz - 02 August 2026"
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Quiz Date</label>
                  <input
                    type="date"
                    value={quizDate}
                    onChange={(e) => setQuizDate(e.target.value)}
                    className="w-full border p-2.5 rounded-lg text-xs bg-white font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={quizDuration}
                    onChange={(e) => setQuizDuration(Number(e.target.value))}
                    className="w-full border p-2.5 rounded-lg text-xs bg-white"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow">
                Create Quiz Container
              </button>
            </form>

            <form onSubmit={editingQuizQuestionId ? handleUpdateBscaQuestion : handleAddQuizQuestion} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 border-b pb-2 flex justify-between items-center">
                <span>{editingQuizQuestionId ? '✏️ Edit Quiz Question' : 'Step 2: Add Question & Explanation'}</span>
                {editingQuizQuestionId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQuizQuestionId(null);
                      setQuizQuestionText('');
                      setQuizOptions(['', '', '', '']);
                      setQuizExplanation('');
                    }}
                    className="text-xs text-rose-600 font-bold underline"
                  >
                    Cancel Edit
                  </button>
                )}
              </h2>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target Quiz Container</label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-xs bg-white font-bold"
                  required
                >
                  <option value="">-- Choose Quiz --</option>
                  {existingQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.quiz_date})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Question Statement (Markdown Supported)</label>
                <textarea
                  rows={2}
                  value={quizQuestionText}
                  onChange={(e) => setQuizQuestionText(e.target.value)}
                  placeholder="Enter question statement..."
                  className="w-full border p-2 rounded-lg text-xs bg-white font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {quizOptions.map((opt, idx) => (
                  <div key={idx}>
                    <label className="block text-[10px] font-bold text-slate-500">Option {String.fromCharCode(65 + idx)}</label>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const updated = [...quizOptions];
                        updated[idx] = e.target.value;
                        setQuizOptions(updated);
                      }}
                      className="w-full border p-1.5 rounded text-xs bg-white"
                      required
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Correct Answer Option</label>
                <select
                  value={quizCorrectOption}
                  onChange={(e) => setQuizCorrectOption(Number(e.target.value))}
                  className="w-full border p-2 rounded-lg text-xs bg-white font-bold"
                >
                  <option value={0}>Option A</option>
                  <option value={1}>Option B</option>
                  <option value={2}>Option C</option>
                  <option value={3}>Option D</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Explanation (Markdown Supported)</label>
                <textarea
                  rows={3}
                  value={quizExplanation}
                  onChange={(e) => setQuizExplanation(e.target.value)}
                  placeholder="Detailed solution or facts using Markdown..."
                  className="w-full border p-2 rounded-lg text-xs bg-white font-mono"
                />
              </div>

              <button type="submit" className={`w-full py-3 text-white font-bold text-xs rounded-xl shadow ${editingQuizQuestionId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {editingQuizQuestionId ? 'Update Question' : 'Add Question to Quiz'}
              </button>
            </form>
          </div>

          {selectedQuizId && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Questions in Selected Quiz ({bscaQuizQuestions.length})</h3>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {bscaQuizQuestions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">No questions added to this quiz yet.</p>
                ) : (
                  bscaQuizQuestions.map((q, idx) => (
                    <div key={q.id} className="py-3 flex justify-between items-start gap-4 text-xs">
                      <div>
                        <span className="font-bold text-indigo-600 mr-2">Q{idx + 1}.</span>
                        <span className="font-semibold text-slate-800">{q.question_text}</span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Correct: Option {String.fromCharCode(65 + Number(q.correct_option_index))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleStartEditBscaQuestion(q)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded transition"
                        >
                          Edit ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteBscaQuestion(q.id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2.5 py-1 rounded transition"
                        >
                          Delete 🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-slate-800">Manage Published BSCA Quizzes ({existingQuizzes.length})</h2>
              <Link href="/bsca-quiz" className="text-xs font-bold text-blue-600 hover:underline">View Live Quiz Page →</Link>
            </div>

            {existingQuizzes.length === 0 ? (
              <p className="text-xs text-slate-500 p-2">No quizzes created yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {existingQuizzes.map((q) => (
                  <div key={q.id} className="py-3 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded mr-2">
                        {q.quiz_date}
                      </span>
                      <span className="font-bold text-slate-800 text-sm">{q.title}</span>
                      <span className="text-xs text-slate-500 ml-2">({q.duration_minutes} Mins)</span>
                    </div>

                    <button
                      onClick={() => handleDeleteQuiz(q.id, q.title)}
                      className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs px-3 py-1.5 rounded-lg transition"
                    >
                      Delete Quiz 🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BSPS & BSCA MANAGER TAB */}
      {activeTab === 'pdf_uploader' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form onSubmit={handleCreateCourseContainer} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 border-b pb-2">Step 1: Create Course Container</h2>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Module Type</label>
                <select
                  value={courseCategory}
                  onChange={(e: any) => setCourseCategory(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold"
                >
                  <option value="BSPS">BSPS – BankingSolutions Practice Sheet</option>
                  <option value="BSCA">BSCA – BankingSolutions Current Affairs</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Course Title</label>
                <input
                  type="text"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder={courseCategory === 'BSPS' ? 'e.g. BSPS 2026 - Reasoning Daily Sheets' : 'e.g. BSCA August 2026 Daily Banking GA'}
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  placeholder="Course details and day-wise release info..."
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                />
              </div>

              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow">
                Create Course Container
              </button>
            </form>

            <form onSubmit={handlePdfUpload} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 border-b pb-2">Step 2: Upload Day-Wise PDF File</h2>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-sm bg-white font-semibold"
                  required
                >
                  <option value="">-- Choose BSPS or BSCA Course --</option>
                  {existingCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.category}] {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Day No.</label>
                  <input
                    type="number"
                    value={dayNumber}
                    onChange={(e) => setDayNumber(Number(e.target.value))}
                    className="w-full border p-2.5 rounded-lg text-sm bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">PDF Title</label>
                  <input
                    type="text"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    placeholder="e.g. Day 1 Practice Sheet"
                    className="w-full border p-2.5 rounded-lg text-sm bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Topics Breakdown (One item per line)</label>
                <textarea
                  rows={4}
                  value={topicList}
                  onChange={(e) => setTopicList(e.target.value)}
                  placeholder={"1. Circular seating arrangement (2 variable) -5ques\n2. Square seating arrangement-5ques\n3. Floor with flat based puzzle-5ques"}
                  className="w-full border p-2.5 rounded-lg text-xs bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Select PDF File (.pdf)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="w-full border p-2 rounded-lg text-xs bg-white"
                  required
                />
              </div>

              <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow">
                Publish Day PDF
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b pb-3">Manage & Remove Published PDFs</h2>

            {existingCourses.length === 0 ? (
              <p className="text-xs text-slate-500">No PDF courses created yet.</p>
            ) : (
              <div className="space-y-6">
                {existingCourses.map((course) => {
                  const coursePdfs = uploadedPdfs.filter((p) => p.course_id === course.id);
                  return (
                    <div key={course.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase mr-2 ${course.category === 'BSCA' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                            {course.category}
                          </span>
                          <span className="font-bold text-slate-800 text-sm">{course.title}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteCourse(course.id, course.title)}
                          className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs px-3 py-1.5 rounded-lg transition"
                        >
                          Delete Course 🗑️
                        </button>
                      </div>

                      <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 p-2">
                        {coursePdfs.length === 0 ? (
                          <p className="text-xs text-slate-400 p-2">No Day PDFs uploaded for this course yet.</p>
                        ) : (
                          coursePdfs.map((pdf) => (
                            <div key={pdf.id} className="py-2.5 px-3 flex justify-between items-center text-xs">
                              <div>
                                <span className="font-bold text-slate-800 mr-2">Day {pdf.day_number}:</span>
                                <span className="text-slate-600">{pdf.title}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-[11px] px-2.5 py-1 rounded cursor-pointer transition">
                                  <span>🔄 Replace PDF</span>
                                  <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => handleReplacePdf(pdf.id, pdf.title, e)}
                                    className="hidden"
                                  />
                                </label>

                                <button
                                  onClick={() => handleDeletePdf(pdf.id, pdf.title)}
                                  className="text-rose-600 hover:text-rose-800 font-bold px-2.5 py-1 hover:bg-rose-50 rounded transition"
                                >
                                  Delete 🗑️
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE EXAM CATEGORY TAB */}
      {activeTab === 'create_exam_tab' && (
        <div className="bg-white shadow-sm rounded-xl p-6 border border-slate-200 space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center space-x-2 border-b pb-3">
            <h2 className="text-lg font-bold text-slate-800">⚙️ Create Hierarchical Exam Category</h2>
          </div>

          <form onSubmit={handleSaveNewExamCategory} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Exam Name (Parent)</label>
                <input
                  type="text"
                  value={parentExamName}
                  onChange={(e) => setParentExamName(e.target.value)}
                  placeholder="e.g. IBPS PO"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Sub-Category Type</label>
                <select
                  value={subCategoryType}
                  onChange={(e) => setSubCategoryType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white font-bold"
                >
                  <option value="Prelims">Prelims</option>
                  <option value="Mains">Mains</option>
                  <option value="PYQ">PYQ (Previous Year Question)</option>
                  <option value="Sectional">Sectional</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Overall Test Duration (Minutes)</label>
              <input
                type="number"
                value={newExamDuration}
                onChange={(e) => setNewExamDuration(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white font-bold"
                required
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold uppercase text-slate-500">Configure Sections & Timers</label>
                <button
                  type="button"
                  onClick={() => setExamSections([...examSections, { name: 'General Awareness', time_minutes: 20 }])}
                  className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-xs rounded-lg transition"
                >
                  + Add Section
                </button>
              </div>

              {examSections.map((sec, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <input
                    type="text"
                    value={sec.name}
                    onChange={(e) => {
                      const updated = [...examSections];
                      updated[idx].name = e.target.value;
                      setExamSections(updated);
                    }}
                    placeholder="Section Name (e.g. Reasoning)"
                    className="flex-1 border border-slate-300 rounded-lg p-2 text-xs bg-white font-semibold"
                    required
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={sec.time_minutes}
                      onChange={(e) => {
                        const updated = [...examSections];
                        updated[idx].time_minutes = Number(e.target.value);
                        setExamSections(updated);
                      }}
                      className="w-20 border border-slate-300 rounded-lg p-2 text-xs bg-white font-bold text-center"
                      required
                    />
                    <span className="text-xs text-slate-500">Mins</span>
                  </div>
                  {examSections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setExamSections(examSections.filter((_, i) => i !== idx))}
                      className="text-rose-600 hover:text-rose-800 font-bold px-2 py-1 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow">
              Save Exam Category 🚀
            </button>
          </form>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Configured Custom Exams ({dynamicExamsList.length})</h3>
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border rounded-xl p-2 bg-slate-50">
              {dynamicExamsList.length === 0 ? (
                <p className="text-xs text-slate-500 p-2">No custom exams created yet.</p>
              ) : (
                dynamicExamsList.map((ex) => (
                  <div key={ex.id} className="py-2 px-3 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-800 mr-2">{ex.exam_name}</span>
                      <span className="text-slate-500">({ex.total_duration_minutes} Mins Total)</span>
                    </div>
                    <button
                      onClick={() => handleDeleteExamCategory(ex.id, ex.exam_name)}
                      className="text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded"
                    >
                      Delete 🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD SINGLE QUESTION TAB */}
      {activeTab === 'add_question' && (
        <form onSubmit={handleQuestionSubmit} className="bg-white shadow-sm rounded-xl p-6 border border-slate-200 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 border-b pb-3">Add Single Question to Master Bank</h2>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
            >
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>{subj.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Question Statement</label>
            <textarea
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {options.map((opt, idx) => (
              <div key={idx}>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Option {String.fromCharCode(65 + idx)}</label>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const updated = [...options];
                    updated[idx] = e.target.value;
                    setOptions(updated);
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 text-xs bg-white"
                  required
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Correct Option (0 = A, 1 = B, 2 = C, 3 = D, 4 = E)</label>
            <select
              value={correctOptionIndex}
              onChange={(e) => setCorrectOptionIndex(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
            >
              <option value={0}>Option A</option>
              <option value={1}>Option B</option>
              <option value={2}>Option C</option>
              <option value={3}>Option D</option>
              <option value={4}>Option E</option>
            </select>
          </div>

          <button type="submit" className="w-full py-3 bg-[#1D63B8] text-white font-bold rounded-xl text-xs">
            Add Question to Bank
          </button>
        </form>
      )}

      {/* BULK UPLOAD TAB */}
      {activeTab === 'bulk_upload' && (
        <div className="bg-white shadow-sm rounded-xl p-6 border border-slate-200 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 border-b pb-3">Bulk Upload to Master Question Bank</h2>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
            >
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>{subj.name}</option>
              ))}
            </select>
          </div>
          <div className="border-2 border-dashed border-slate-300 p-8 rounded-xl text-center bg-slate-50 relative cursor-pointer">
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            <span className="text-sm font-bold text-blue-600 block">Click to upload Question Bank Excel (.xlsx)</span>
          </div>
        </div>
      )}

      {/* TARGETS MANAGER TAB */}
      {activeTab === 'targets_manager' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveTargetConfig} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-base font-bold text-slate-800">Manage Day-Wise YouTube Video Targets</h2>
              {targetDayNo > 1 && (
                <button
                  type="button"
                  onClick={handleCopyVideoFromPreviousDay}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 transition"
                >
                  📋 Copy Video from Day {targetDayNo - 1}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Select Day No.</label>
                <input
                  type="number"
                  min={1}
                  value={targetDayNo}
                  onChange={(e) => setTargetDayNo(Number(e.target.value))}
                  className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target Track Mode</label>
                <select
                  value={targetTrackMode}
                  onChange={(e: any) => setTargetTrackMode(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-xs bg-white font-bold"
                >
                  <option value="beginner">🌱 Beginner Track</option>
                  <option value="repeater">🔥 Repeater Track</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">YouTube Embed URL</label>
                <input
                  type="text"
                  value={targetVideoUrl}
                  onChange={(e) => setTargetVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/embed/VIDEO_ID"
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                  required
                />
              </div>
            </div>

            <button type="submit" className="w-full py-3 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow">
              Save Day {targetDayNo} Video Target 🚀
            </button>
          </form>

          {/* DAY-SPECIFIC CHECKLIST BUILDER */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-base font-bold text-slate-800">
                Manage Checklist Items for Day {targetDayNo} ({targetTrackMode.toUpperCase()})
              </h2>
              {targetDayNo > 1 && (
                <button
                  type="button"
                  onClick={handleCopyChecklistFromPreviousDay}
                  className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-300 transition flex items-center gap-1.5"
                >
                  <span>📋</span> Copy Checklist from Day {targetDayNo - 1}
                </button>
              )}
            </div>

            <form onSubmit={handleAddDayChecklistItem} className="flex gap-2">
              <input
                type="text"
                value={dayChecklistInput}
                onChange={(e) => setDayChecklistInput(e.target.value)}
                placeholder={`e.g. Day ${targetDayNo} Specific Quant Puzzle or Tables 1-20`}
                className="flex-1 border p-2.5 rounded-lg text-xs bg-white font-medium"
                required
              />
              <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow">
                + Add to Day {targetDayNo}
              </button>
            </form>

            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {dayChecklistItems.length === 0 ? (
                <p className="text-xs text-slate-500">No specific checklist items added for Day {targetDayNo} ({targetTrackMode}) yet.</p>
              ) : (
                dayChecklistItems.map((item) => (
                  <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteDayChecklistItem(item.id, item.label)}
                      className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-2.5 py-1 rounded transition"
                    >
                      Delete 🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MARQUEE NOTICE BUILDER */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b pb-2">Manage Landing Page Marquee Ticker Notices</h2>

            <form onSubmit={handleAddMarqueeNotice} className="flex gap-2">
              <input
                type="text"
                value={marqueeInput}
                onChange={(e) => setMarqueeInput(e.target.value)}
                placeholder="e.g. 🔥 SBI PO 2026 Prelims Mock Test 01 is now live! Attempt now."
                className="flex-1 border p-2.5 rounded-lg text-xs bg-white font-medium"
                required
              />
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow">
                + Add Notice
              </button>
            </form>

            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {adminMarqueeList.length === 0 ? (
                <p className="text-xs text-slate-500">No marquee notices active.</p>
              ) : (
                adminMarqueeList.map((m) => (
                  <div key={m.id} className="py-2.5 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{m.notice_text}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteMarqueeNotice(m.id)}
                      className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-2.5 py-1 rounded transition"
                    >
                      Delete 🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form onSubmit={handleAddExamCountdown} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 border-b pb-2">Add Exam Countdown</h2>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Exam Name</label>
                <input
                  type="text"
                  value={examNameInput}
                  onChange={(e) => setExamNameInput(e.target.value)}
                  placeholder="e.g. SBI PO Prelims 2026"
                  className="w-full border p-2.5 rounded-lg text-sm bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target Exam Date</label>
                <input
                  type="date"
                  value={examDateInput}
                  onChange={(e) => setExamDateInput(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold"
                  required
                />
              </div>

              <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow">
                Add Exam Countdown
              </button>
            </form>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 border-b pb-2">Active Countdowns ({adminExamsList.length})</h2>

              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {adminExamsList.length === 0 ? (
                  <p className="text-xs text-slate-500">No active exam countdowns.</p>
                ) : (
                  adminExamsList.map((ex) => (
                    <div key={ex.id} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">{ex.exam_name}</span>
                        <span className="text-slate-500">Date: {ex.exam_date}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteExamCountdown(ex.id, ex.exam_name)}
                        className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-2.5 py-1 rounded transition"
                      >
                        Delete 🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOCK ANALYTICS TAB */}
      {activeTab === 'mock_analytics' && (
        <div className="bg-white shadow-sm rounded-xl p-6 border border-slate-200 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">📊 Mock-wise Student Attempt Statistics</h2>
              <p className="text-xs text-slate-500">Analyze aspirant performance, scores, and completion metrics per test.</p>
            </div>

            <div className="w-full md:w-auto flex flex-col items-end gap-2">
              <div className="w-full md:w-72">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Select Mock Test</label>
                <select
                  value={selectedAnalyticsMockId}
                  onChange={(e) => {
                    setSelectedAnalyticsMockId(e.target.value);
                    fetchMockAnalytics(e.target.value);
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white font-bold text-slate-800"
                >
                  <option value="">-- Choose Test --</option>
                  {existingMocks.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.exam_type || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedAnalyticsMockId && mockAttemptsList.length > 0 && (
                <button
                  onClick={() => handleRecalculateScores(selectedAnalyticsMockId)}
                  className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs rounded-lg transition border border-amber-300 shadow-sm"
                >
                  ⚠️ Recalculate All Scores
                </button>
              )}
            </div>
          </div>

          {loadingAnalytics ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              Loading Attempt Statistics...
            </div>
          ) : !selectedAnalyticsMockId ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Please select a mock test from the dropdown above to view student statistics.
            </div>
          ) : mockAttemptsList.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed">
              📝 No student attempts recorded for this mock test yet.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800">Overall Performance Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-3 p-2">
                    <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center font-black">🏆</div>
                    <div>
                      <span className="text-xs text-slate-400 block font-bold">Rank</span>
                      <span className="text-base font-black text-slate-800">1 / {mockAttemptsList.length}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2">
                    <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center font-black">🎯</div>
                    <div>
                      <span className="text-xs text-slate-400 block font-bold">Score</span>
                      <span className="text-base font-black text-slate-800">
                        {Number(mockAttemptsList[0]?.score || 0).toFixed(1)} / {existingMocks.find(m => m.id === selectedAnalyticsMockId)?.total_marks || 100}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2">
                    <div className="w-10 h-10 rounded-full bg-cyan-500 text-white flex items-center justify-center font-black">📝</div>
                    <div>
                      <span className="text-xs text-slate-400 block font-bold">Attempted</span>
                      <span className="text-base font-black text-slate-800">
                        {Object.keys(mockAttemptsList[0]?.user_answers || mockAttemptsList[0]?.answers || {}).length} Qs
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black">⚡</div>
                    <div>
                      <span className="text-xs text-slate-400 block font-bold">Accuracy</span>
                      <span className="text-base font-black text-slate-800">100%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2">
                    <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-black">📈</div>
                    <div>
                      <span className="text-xs text-slate-400 block font-bold">Percentile</span>
                      <span className="text-base font-black text-slate-800">95.0%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cutoff Status Flash Message */}
              {(() => {
                const currentTest = existingMocks.find(m => m.id === selectedAnalyticsMockId);
                const cutoff = currentTest?.cutoff_marks ?? 55;
                const topScore = Number(mockAttemptsList[0]?.score || 0);
                const passed = topScore >= cutoff;

                return (
                  <div className={`p-4 rounded-xl border font-bold text-xs flex items-center gap-3 ${passed ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
                    <span className="text-xl">{passed ? '🎉' : '⚠️'}</span>
                    <div>
                      <span className="block text-sm font-black">{passed ? 'Congratulations!' : 'Thank you for appearing!'}</span>
                      <p className="font-medium mt-0.5">
                        {passed 
                          ? `Based on your performance (Score: ${topScore.toFixed(1)}), you have cleared the cut-off (${cutoff} marks). Touch the sky with glory!` 
                          : `Based on your performance (Score: ${topScore.toFixed(1)}), you have not cleared the cut-off (${cutoff} marks). Keep practicing with BankingSolutions!`}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-center">Rank / Position</th>
                      <th className="p-3">Aspirant Name</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Score Obtained</th>
                      <th className="p-3 text-center">Total Marks</th>
                      <th className="p-3 text-right">Attempt Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {mockAttemptsList.map((attempt, index) => (
                      <tr key={attempt.id || index} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-center font-bold text-indigo-600">#{index + 1}</td>
                        <td className="p-3 font-bold text-slate-800">{attempt.aspirant_name || 'Aspirant'}</td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${attempt.status === 'in_progress' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {attempt.status || 'submitted'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-black text-emerald-600 text-sm">
                          {Number(attempt.score || 0).toFixed(1)}
                        </td>
                        <td className="p-3 text-center font-semibold text-slate-600">
                          {Number(attempt.total_marks) || 100}
                        </td>
                        <td className="p-3 text-right text-slate-400">
                          {attempt.created_at ? new Date(attempt.created_at).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PUBLISHED MOCK TESTS OVERVIEW */}
      <div className="bg-white shadow-sm rounded-xl p-6 border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-lg font-bold text-slate-800">Published Tests & Practice Sheets ({existingMocks.length})</h2>
          <Link href="/tests" className="text-xs font-bold text-blue-600 hover:underline">
            View Live Student Portal →
          </Link>
        </div>

        {existingMocks.length === 0 ? (
          <p className="text-xs text-slate-500">No published tests yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {existingMocks.map((test) => {
              const matchedSubCard = subCategories.find((sc) => sc.id === test.sub_category_id);
              return (
                <div key={test.id} className="py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        {test.exam_type || 'SBI PO Prelims'}
                      </span>
                      {matchedSubCard && (
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          {matchedSubCard.parent_exam_name} → {matchedSubCard.sub_card_title}
                        </span>
                      )}
                      <h3 className="font-bold text-slate-800 text-sm">{test.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{test.duration_minutes} Mins</span>
                      <span>|</span>
                      <span>{test.total_marks} Marks</span>
                      <span>|</span>
                      <span className="flex items-center gap-1">
                        Cut-off: 
                        {editingCutoffId === test.id ? (
                          <div className="flex items-center gap-1 ml-1">
                            <input
                              type="number"
                              value={tempCutoffValue}
                              onChange={(e) => setTempCutoffValue(Number(e.target.value))}
                              className="w-16 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-900 font-bold bg-white"
                            />
                            <button
                              onClick={() => handleUpdateCutoff(test.id, tempCutoffValue)}
                              className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCutoffId(null)}
                              className="bg-slate-300 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingCutoffId(test.id);
                              setTempCutoffValue(test.cutoff_marks ?? 55);
                            }}
                            className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 transition"
                          >
                            {test.cutoff_marks ?? 55} ✏️
                          </button>
                        )}
                      </span>
                      <span>|</span>
                      <span>{Array.isArray(test.questions) ? `${test.questions.length} Qs` : ''}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-sm">
                      <span>🔄 Replace Excel</span>
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => handleReplaceMockExcel(test.id, test.title, e)}
                        className="hidden"
                      />
                    </label>

                    <button
                      onClick={() => handleDeleteMockTest(test.id, test.title)}
                      className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs px-3 py-1.5 rounded-lg transition"
                    >
                      Delete 🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}