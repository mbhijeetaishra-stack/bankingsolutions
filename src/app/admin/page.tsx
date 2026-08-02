'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import * as XLSX from 'xlsx';

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
  duration_minutes: number;
  total_marks: number;
  is_published: boolean;
  questions?: any[];
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

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    'updates_publisher' | 'bsca_quiz_builder' | 'pdf_uploader' | 'direct_mock_upload' | 'create_mock' | 'add_question' | 'bulk_upload'
  >('updates_publisher');

  // Admin Security States
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Common Admin States
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState('');

  // Single Question Form State
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [solutionText, setSolutionText] = useState('');

  // Mock Test Builder State
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState<string>('ALL');
  const [mockTitle, setMockTitle] = useState('');
  const [mockExamType, setMockExamType] = useState('SBI PO Prelims');
  const [mockDuration, setMockDuration] = useState(60);
  const [mockMarks, setMockMarks] = useState(100);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [existingMocks, setExistingMocks] = useState<MockTest[]>([]);

  // Direct Mock Upload State
  const [directMockTitle, setDirectMockTitle] = useState('');
  const [directMockExamType, setDirectMockExamType] = useState('SBI PO Prelims');
  const [directMockDuration, setDirectMockDuration] = useState(60);
  const [directMockMarks, setDirectMockMarks] = useState(100);

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

  // Updates & One-Liners Publisher States (Enhanced with Media & Link Support)
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

  // Check auth & profile on mount
  useEffect(() => {
    checkAdminAuth();
  }, []);

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
    // 1. Fetch Subjects
    const { data: subData } = await supabase.from('subjects').select('*');
    if (subData && subData.length > 0) {
      setSubjects(subData);
      setSelectedSubject(subData[0].id);
    }

    // 2. Fetch Question Bank
    const { data: qData } = await supabase
      .from('questions')
      .select('id, question_text, subject_id, options, correct_option_index, solution_text, subjects(name)');
    if (qData) setAllQuestions(qData as unknown as Question[]);

    // 3. Fetch Published Mocks
    const { data: mData } = await supabase
      .from('mock_tests')
      .select('*')
      .order('created_at', { ascending: false });
    if (mData) setExistingMocks(mData);

    // 4. Fetch PDF Courses (BSPS & BSCA)
    const { data: cData } = await supabase
      .from('pdf_courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (cData) setExistingCourses(cData as PdfCourse[]);

    // 5. Fetch Day-Wise PDFs
    const { data: pData } = await supabase
      .from('course_pdfs')
      .select('*')
      .order('day_number', { ascending: true });
    if (pData) setUploadedPdfs(pData as CoursePdf[]);

    // 6. Fetch Updates Feed
    const { data: uData } = await supabase
      .from('updates_feed')
      .select('*')
      .order('created_at', { ascending: false });
    if (uData) setPublishedFeed(uData as UpdatePost[]);

    // 7. Fetch Quizzes
    const { data: quizData } = await supabase
      .from('bsca_quizzes')
      .select('*')
      .order('quiz_date', { ascending: false });
    if (quizData) setExistingQuizzes(quizData);
  }

  // --- PUBLISH ONE-LINER OR EXAM UPDATE (WITH IMAGE & LINK SUPPORT) ---
  async function handlePublishPost(e: React.FormEvent) {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) return setStatusMsg('⚠️ Please enter Title and Content!');

    setStatusMsg('Publishing update...');
    let finalImageUrl = postImageUrl.trim();

    // Upload image file if attached
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

  // --- DELETE UPDATE POST ---
  async function handleDeletePost(postId: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    const { error } = await supabase.from('updates_feed').delete().eq('id', postId);
    if (!error) {
      setStatusMsg(`🗑️ Deleted update.`);
      fetchInitialData();
    }
  }

  // --- CREATE BSCA QUIZ CONTAINER ---
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

  // --- ADD QUESTION TO BSCA QUIZ ---
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
    }
  }

  // --- DELETE BSCA QUIZ ---
  async function handleDeleteQuiz(quizId: string, title: string) {
    if (!confirm(`Delete Quiz "${title}" and all its questions?`)) return;

    const { error } = await supabase.from('bsca_quizzes').delete().eq('id', quizId);
    if (!error) {
      setStatusMsg(`🗑️ Deleted Quiz "${title}".`);
      fetchInitialData();
    }
  }

  // --- SINGLE QUESTION SUBMIT ---
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

  // --- EXCEL BULK UPLOAD FOR QUESTION BANK ---
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

  // --- CREATE MOCK FROM QUESTION BANK ---
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

  // --- DIRECT 1-CLICK EXCEL MOCK UPLOADER ---
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
          let rawSec = String(row.section || row.Subject || 'QUANT').trim().toUpperCase();
          let normSec = 'QUANT';

          if (rawSec.includes('ENG')) normSec = 'ENGLISH';
          else if (rawSec.includes('REASON')) normSec = 'REASONING';
          else if (rawSec.includes('QUANT') || rawSec.includes('MATH')) normSec = 'QUANT';
          else if (rawSec.includes('GA') || rawSec.includes('CURRENT') || rawSec.includes('AWARE')) normSec = 'GA';

          const answerLetter = String(row.correctOptionIndex ?? row['Correct Answer'] ?? row.correctOption ?? '0').toUpperCase().trim();
          const optionMap: { [key: string]: number } = { A: 0, B: 1, C: 2, D: 3, E: 4, '0': 0, '1': 1, '2': 2, '3': 3, '4': 4 };
          const correctIdx = optionMap[answerLetter] !== undefined ? optionMap[answerLetter] : 0;

          const options = [
            String(row.optionA || row['Option A'] || row.option1 || ''),
            String(row.optionB || row['Option B'] || row.option2 || ''),
            String(row.optionC || row['Option C'] || row.option3 || ''),
            String(row.optionD || row['Option D'] || row.option4 || ''),
            String(row.optionE || row['Option E'] || row.option5 || ''),
          ].filter(Boolean);

          return {
            id: `q-${idx + 1}-${Date.now()}`,
            section: normSec,
            passageText: String(row.passageText || row.passage || row['Solution Text'] || '').trim(),
            questionText: String(row.questionText || row.question || row['Question Text'] || `Question ${idx + 1}`).trim(),
            options: options.length > 0 ? options : ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'],
            correctOptionIndex: correctIdx,
            marks: Number(row.marks ?? 1.0),
            negativeMarks: Number(row.negativeMarks ?? 0.25),
          };
        });

        const payload = {
          title: directMockTitle.trim(),
          exam_type: directMockExamType,
          duration_minutes: Number(directMockDuration),
          total_marks: Number(directMockMarks),
          questions: formattedJSONQuestions,
          is_published: true,
          created_at: new Date().toISOString(),
        };

        const { data: testData, error: tErr } = await supabase.from('mock_tests').insert([payload]).select();

        if (tErr || !testData) return setStatusMsg(`Publish Error: ${tErr?.message}`);

        setStatusMsg(`🎉 Created "${directMockTitle}" with ${data.length} questions!`);
        setDirectMockTitle('');
        fetchInitialData();
      } catch (err: any) {
        setStatusMsg(`Direct Upload Error: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // --- CREATE BSPS / BSCA COURSE CONTAINER ---
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

  // --- UPLOAD DAY-WISE PDF FOR BSPS / BSCA WITH TOPICS ---
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

  // --- DELETE SINGLE DAY PDF ---
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

  // --- DELETE ENTIRE COURSE ---
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

  // Selection & Delete Helpers
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

  async function handleDeleteMockTest(testId: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    const { error } = await supabase.from('mock_tests').delete().eq('id', testId);
    if (!error) fetchInitialData();
  }

  // --------------------------------------------------------------------------
  // AUTH GUARD VIEW
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // MAIN ADMIN PORTAL VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="max-w-5xl mx-auto p-6 font-sans text-slate-900 bg-slate-50 min-h-screen space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">BankingSolutions Admin Portal</h1>
          <p className="text-xs text-slate-500">Manage One-Liners, Quizzes, Excel Mocks, BSPS & BSCA PDFs</p>
        </div>

        <div className="flex items-center gap-3">
          {/* TABS NAVBAR */}
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs flex-wrap gap-y-1">
            <button
              onClick={() => setActiveTab('updates_publisher')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'updates_publisher' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📢 One-Liners & Updates
            </button>
            <button
              onClick={() => setActiveTab('bsca_quiz_builder')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'bsca_quiz_builder' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💡 BSCA Quiz Builder
            </button>
            <button
              onClick={() => setActiveTab('pdf_uploader')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'pdf_uploader' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📄 BSPS & BSCA Manager
            </button>
            <button
              onClick={() => setActiveTab('direct_mock_upload')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'direct_mock_upload' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🚀 Direct Mock Upload
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
              + Add Question
            </button>
            <button
              onClick={() => setActiveTab('bulk_upload')}
              className={`px-3 py-1.5 font-semibold rounded-md transition ${
                activeTab === 'bulk_upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📥 Question Bank Excel
            </button>
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

      {/* -------------------------------------------------------------------- */}
      {/* TAB 1: UPDATES & CURRENT AFFAIRS ONE-LINERS PUBLISHER */}
      {/* -------------------------------------------------------------------- */}
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

            {/* ATTACH IMAGE & LINK INPUTS */}
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

          {/* PUBLISHED FEED LIST */}
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

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: BSCA QUIZ BUILDER */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'bsca_quiz_builder' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Create Quiz Container */}
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

            {/* Step 2: Add Question with Options & Explanation */}
            <form onSubmit={handleAddQuizQuestion} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 border-b pb-2">Step 2: Add Question & Explanation</h2>

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
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Question Statement</label>
                <textarea
                  rows={2}
                  value={quizQuestionText}
                  onChange={(e) => setQuizQuestionText(e.target.value)}
                  placeholder="Enter question statement..."
                  className="w-full border p-2 rounded-lg text-xs bg-white"
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
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Explanation</label>
                <textarea
                  rows={2}
                  value={quizExplanation}
                  onChange={(e) => setQuizExplanation(e.target.value)}
                  placeholder="Detailed solution or facts..."
                  className="w-full border p-2 rounded-lg text-xs bg-white"
                />
              </div>

              <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow">
                Add Question to Quiz
              </button>
            </form>
          </div>

          {/* Manage Published Quizzes */}
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

      {/* -------------------------------------------------------------------- */}
      {/* TAB 3: BSPS & BSCA DAY-WISE PDF UPLOADER & MANAGER */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'pdf_uploader' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CREATE COURSE CONTAINER */}
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

            {/* UPLOAD DAY-WISE PDF WITH SUB-TOPICS */}
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

          {/* LIST & DELETE COURSES & DAY PDFs */}
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

                      {/* Day PDFs List */}
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
                              <button
                                onClick={() => handleDeletePdf(pdf.id, pdf.title)}
                                className="text-rose-600 hover:text-rose-800 font-bold px-2 py-1 hover:bg-rose-50 rounded transition"
                              >
                                Delete PDF 🗑️
                              </button>
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

      {/* -------------------------------------------------------------------- */}
      {/* TAB 4: DIRECT EXCEL MOCK UPLOADER */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'direct_mock_upload' && (
        <div className="bg-white shadow-sm rounded-xl p-6 border border-slate-200 space-y-6">
          <div className="flex items-center space-x-2 border-b pb-3">
            <h2 className="text-lg font-bold text-slate-800">1-Click Direct Mock Upload (Excel .xlsx)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mock Test Title</label>
              <input
                type="text"
                value={directMockTitle}
                onChange={(e) => setDirectMockTitle(e.target.value)}
                placeholder="e.g. SBI PO Prelims - Direct Mock 01"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Category / Exam Type</label>
              <select
                value={directMockExamType}
                onChange={(e) => setDirectMockExamType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white font-semibold"
              >
                <option value="SBI PO Prelims">SBI PO Prelims</option>
                <option value="IBPS PO Prelims">IBPS PO Prelims</option>
                <option value="Quant Sectional Mock">Quant Sectional Mock</option>
                <option value="Reasoning Sectional Mock">Reasoning Sectional Mock</option>
                <option value="English Sectional Mock">English Sectional Mock</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
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
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white"
                />
              </div>
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
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 5: BUILD MOCK FROM QUESTION BANK */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'create_mock' && (
        <div className="space-y-6">
          <form onSubmit={handleMockFromQuestionBankSubmit} className="bg-white shadow-sm rounded-xl p-6 border border-slate-200 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-3">Build Mock Test from Question Bank</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
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
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Category / Exam Type</label>
                <select
                  value={mockExamType}
                  onChange={(e) => setMockExamType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm bg-white font-semibold"
                >
                  <option value="SBI PO Prelims">SBI PO Prelims</option>
                  <option value="IBPS PO Prelims">IBPS PO Prelims</option>
                  <option value="Quant Sectional Mock">Quant Sectional Mock</option>
                  <option value="Reasoning Sectional Mock">Reasoning Sectional Mock</option>
                  <option value="English Sectional Mock">English Sectional Mock</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
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

      {/* -------------------------------------------------------------------- */}
      {/* TAB 6: ADD SINGLE QUESTION TO MASTER BANK */}
      {/* -------------------------------------------------------------------- */}
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

      {/* -------------------------------------------------------------------- */}
      {/* TAB 7: BULK QUESTION BANK UPLOADER */}
      {/* -------------------------------------------------------------------- */}
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
            {existingMocks.map((test) => (
              <div key={test.id} className="py-3 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      {test.exam_type || 'SBI PO Prelims'}
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm">{test.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {test.duration_minutes} Mins | {test.total_marks} Marks | Questions Loaded: {test.questions ? (typeof test.questions === 'string' ? JSON.parse(test.questions).length : test.questions.length) : 0}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteMockTest(test.id, test.title)}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs px-3 py-1.5 rounded-lg transition"
                >
                  Delete 🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}