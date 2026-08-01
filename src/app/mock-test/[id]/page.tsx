'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { TwoPaneMockEngine } from '@/components/TwoPaneMockEngine';
import { TestResultView } from '@/components/TestResultView';
import { supabase } from '@/lib/supabase';
import { SectionConfig, Question, UserAnswer, SubjectCategory } from '@/types/mock';

export default function DynamicMockTestPage() {
  const params = useParams();
  const testId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testTitle, setTestTitle] = useState<string>('');
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [testCompleted, setTestCompleted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});

  useEffect(() => {
    async function fetchTest() {
      if (!testId) return;
      setLoading(true);

      try {
        // Fetch mock test from Supabase by UUID
        const { data, error } = await supabase
          .from('mock_tests')
          .select('*')
          .eq('id', testId)
          .single();

        if (error) throw error;

        if (data) {
          // Set dynamic test title (e.g. SBI PO Prelims Mock Test - 6)
          setTestTitle(data.title || 'BankingSolutions Mock Test');

          // Parse questions JSON if it's stringified, or read directly
          let rawQuestions: any[] = [];
          if (data.questions) {
            rawQuestions = typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions;
          }

          if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
            // 1. Format & normalize raw questions
            const formattedQuestions: Question[] = rawQuestions.map((q, idx) => {
              let sec = String(q.section || 'QUANT').trim().toUpperCase();

              // Dynamic section mapping aliases
              if (sec.includes('ENG')) sec = 'ENGLISH';
              else if (sec.includes('REASON')) sec = 'REASONING';
              else if (sec.includes('QUANT') || sec.includes('MATH')) sec = 'QUANT';
              else if (sec.includes('GA') || sec.includes('AWARE')) sec = 'GA';

              const options = Array.isArray(q.options) ? q.options : [
                q.optionA || q.option1 || '',
                q.optionB || q.option2 || '',
                q.optionC || q.option3 || '',
                q.optionD || q.option4 || '',
                q.optionE || q.option5 || '',
              ].filter(Boolean);

              return {
                id: q.id || `q-${idx + 1}`,
                section: sec as SubjectCategory,
                passageText: String(q.passageText || q.passage || '').trim(),
                questionText: String(q.questionText || q.question || `Question ${idx + 1}`).trim(),
                options: options.length > 0 ? options : ['A', 'B', 'C', 'D', 'E'],
                correctOptionIndex: Number(q.correctOptionIndex ?? q.correctOption ?? 0),
                marks: Number(q.marks ?? 1.0),
                negativeMarks: Number(q.negativeMarks ?? 0.25),
              };
            });

            // 2. Standard Prelims / Mains section order
            const sectionKeys: SubjectCategory[] = ['ENGLISH', 'QUANT', 'REASONING', 'GA'];
            const sectionTitles: Record<SubjectCategory, string> = {
              ENGLISH: 'English Language',
              QUANT: 'Quantitative Aptitude',
              REASONING: 'Reasoning Ability',
              GA: 'General Awareness',
            };

            // 3. Group questions into active sections
            const groupedSections: SectionConfig[] = sectionKeys
              .map((secKey) => ({
                id: secKey,
                title: sectionTitles[secKey],
                durationInSeconds: 1200, // 20 Mins per section
                questions: formattedQuestions.filter((q) => q.section === secKey),
              }))
              .filter((sec) => sec.questions.length > 0);

            if (groupedSections.length === 0) {
              setErrorMessage('No recognized sections found in the questions data.');
            } else {
              setSections(groupedSections);
            }
          } else {
            setErrorMessage('This mock test has no saved questions in the database.');
          }
        }
      } catch (err: any) {
        console.error('Failed to load test:', err);
        setErrorMessage(err.message || 'Error loading mock test.');
      } finally {
        setLoading(false);
      }
    }

    fetchTest();
  }, [testId]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#1D63B8] text-white font-bold space-y-3">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm tracking-wide">Loading Exam Environment & Questions...</p>
      </div>
    );
  }

  if (errorMessage || sections.length === 0) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-900 text-white p-6 text-center space-y-4">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold">Unable to Start Test</h2>
        <p className="text-sm text-slate-400 max-w-md">
          {errorMessage || 'No valid questions were found for this test session.'}
        </p>
        <a
          href="/tests"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 font-bold rounded-lg text-xs transition shadow-lg"
        >
          ← Back to Available Tests
        </a>
      </div>
    );
  }

  if (testCompleted) {
    return (
      <TestResultView
        sections={sections}
        userAnswers={userAnswers}
        onRetake={() => {
          setUserAnswers({});
          setTestCompleted(false);
        }}
      />
    );
  }

  return (
    <TwoPaneMockEngine
      testTitle={testTitle}
      sections={sections}
      onCompleteTest={(answers) => {
        setUserAnswers(answers);
        setTestCompleted(true);
      }}
    />
  );
}