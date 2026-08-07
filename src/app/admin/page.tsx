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

interface ExamCategory {
  id: string;
  exam_name: string;
  sub_category: string; // Prelims, Mains, PYQ, etc.
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

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    | 'updates_publisher'
    | 'bsca_quiz_builder'
    | 'pdf_uploader'
    | 'direct_mock_upload'
    | 'create_exam_tab'
    | 'create_mock'
    | 'add_question'
    | 'bulk_upload'
    | 'targets_manager'
  >('updates_publisher');

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState('');

  // 🟢 Hierarchical Exam Creator States
  const [parentExamName, setParentExamName] = useState('IBPS PO');
  const [subCategoryType, setSubCategoryType] = useState('Prelims'); // Prelims, Mains, PYQ
  const [newExamDuration, setNewExamDuration] = useState(60);
  const [examSections, setExamSections] = useState<{ name: string; time_minutes: number }[]>([
    { name: 'Quantitative Aptitude', time_minutes: 20 },
    { name: 'Reasoning Ability', time_minutes: 20 },
    { name: 'English Language', time_minutes: 20 },
  ]);
  const [dynamicExamsList, setDynamicExamsList] = useState<ExamCategory[]>([]);

  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [solutionText, setSolutionText] = useState('');

  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState<string>('ALL');
  const [mockTitle, setMockTitle] = useState('');
  const [mockExamType, setMockExamType] = useState('IBPS PO - Prelims');
  const [mockDuration, setMockDuration] = useState(60);
  const [mockMarks, setMockMarks] = useState(100);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [existingMocks, setExistingMocks] = useState<MockTest[]>([]);

  const [directMockTitle, setDirectMockTitle] = useState('');
  const [directMockExamType, setDirectMockExamType] = useState('IBPS PO - Prelims');
  const [directMockDuration, setDirectMockDuration] = useState(60);
  const [directMockMarks, setDirectMockMarks] = useState(100);

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

  const [quizTitle, setQuizTitle] = useState('');
  const [quizDate, setQuizDate] = useState(new Date().toISOString().split('T')[0]);
  const [quizDuration, setQuizDuration] = useState(10);
  const [existingQuizzes, setExistingQuizzes] = useState<any[]>([]);

  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [quizQuestionText, setQuizQuestionText] = useState('');
  const [quizOptions, setQuizOptions] = useState(['', '', '', '']);
  const [quizCorrectOption, setQuizCorrectOption] = useState(0);
  const [quizExplanation, setQuizExplanation] = useState('');

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

  useEffect(() => {
    checkAdminAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchDaySpecificData(targetDayNo, targetTrackMode);
    }
  }, [targetDayNo, targetTrackMode, isAdmin]);

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
  }

  // 🟢 Save hierarchical exam category (e.g., IBPS PO - Mains)
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
          let rawSec = String(row.section || row.Subject || '').trim().toUpperCase();
          let normSec = 'GA';

          if (!rawSec) {
            if (directMockExamType.includes('BSCA') || directMockExamType.includes('Current') || directMockExamType.includes('GA')) {
              normSec = 'GA';
            } else if (directMockExamType.includes('English')) {
              normSec = 'ENGLISH';
            } else if (directMockExamType.includes('Reasoning')) {
              normSec = 'REASONING';
            } else if (directMockExamType.includes('Quant')) {
              normSec = 'QUANT';
            } else {
              normSec = 'GA';
            }
          } else {
            if (rawSec.includes('ENG')) normSec = 'ENGLISH';
            else if (rawSec.includes('REASON')) normSec = 'REASONING';
            else if (rawSec.includes('QUANT') || rawSec.includes('MATH')) normSec = 'QUANT';
            else if (rawSec.includes('GA') || rawSec.includes('CURRENT') || rawSec.includes('AWARE') || rawSec.includes('GS')) normSec = 'GA';
          }

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

  async function handleDeleteTargetConfig(id: string, day: number, mode: string) {
    if (!confirm(`Delete Day ${day} (${mode}) video config?`)) return;
    const { error } = await supabase.from('admin_targets_config').delete().eq('id', id);
    if (!error) {
      setStatusMsg(`🗑️ Deleted Day ${day} config.`);
      fetchInitialData();
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
          <p className="text-xs text-slate-500">Manage One-Liners, Quizzes, Excel Mocks, BSPS & BSCA PDFs</p>
        </div>

        <div className="flex items-center gap-3">
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
              onClick={() => setActiveTab('create_exam_tab')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'create_exam_tab' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚙️ Create Exam Category
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
            <button
              onClick={() => setActiveTab('targets_manager')}
              className={`px-3 py-1.5 font-bold rounded-md transition ${
                activeTab === 'targets_manager' ? 'bg-[#1D63B8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎯 Daily Targets & Countdowns
            </button>
            <Link
              href="/admin/computer-quiz"
              className="px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 text-slate-700 hover:text-blue-600 hover:bg-slate-100"
            >
              <span>💻</span> Computer Quiz Builder
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

      {/* TAB 1: UPDATES & CURRENT AFFAIRS ONE-LINERS PUBLISHER */}
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

      {/* TAB 2: BSCA QUIZ BUILDER */}
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

      {/* TAB 3: BSPS & BSCA DAY-WISE PDF UPLOADER & MANAGER */}
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

      {/* 🟢 NEW TAB: HIERARCHICAL EXAM CREATOR (IBPS PO -> Prelims/Mains/PYQ) */}
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

      {/* TAB 4: DIRECT EXCEL MOCK UPLOADER */}
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
                placeholder="e.g. IBPS PO Mains - Direct Mock 01"
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
                <option value="BSCA">BSCA (Current Affairs Quiz)</option>
                <option value="BSPS">BSPS (Practice Sheet Quiz)</option>
                {dynamicExamsList.map((ex) => (
                  <option key={ex.id} value={ex.exam_name}>{ex.exam_name}</option>
                ))}
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
                    {test.duration_minutes} Mins | {test.total_marks} Marks
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