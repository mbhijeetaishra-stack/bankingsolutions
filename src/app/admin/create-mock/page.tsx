'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { SubjectCategory, Question } from '@/types/mock';
import { supabase } from '@/lib/supabase';

export default function CreateMockPage() {
  const [title, setTitle] = useState('');
  const [examType, setExamType] = useState('SBI PO Prelims');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Excel Upload Handler with Debug Logging
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

        console.log('Raw Excel Rows Count:', rawRows.length);
        console.log('Sample Row 0:', rawRows[0]);

        if (!rawRows || rawRows.length === 0) {
          alert('Excel file is empty!');
          setIsUploading(false);
          return;
        }

        const parsedQuestions: Question[] = rawRows.map((row, idx) => {
          let rawSec = String(row.section || 'QUANT').trim().toUpperCase();
          let normSec: SubjectCategory = 'QUANT';

          if (rawSec.includes('ENG')) normSec = 'ENGLISH';
          else if (rawSec.includes('REASON')) normSec = 'REASONING';
          else if (rawSec.includes('QUANT') || rawSec.includes('MATH')) normSec = 'QUANT';
          else if (rawSec.includes('GA')) normSec = 'GA';

          const options = [
            String(row.optionA || row.option1 || ''),
            String(row.optionB || row.option2 || ''),
            String(row.optionC || row.option3 || ''),
            String(row.optionD || row.option4 || ''),
            String(row.optionE || row.option5 || ''),
          ].filter(Boolean);

          return {
            id: `q-${idx + 1}-${Date.now()}`,
            section: normSec,
            passageText: String(row.passageText || row.passage || '').trim(),
            questionText: String(row.questionText || row.question || `Question ${idx + 1}`).trim(),
            options: options.length > 0 ? options : ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'],
            correctOptionIndex: Number(row.correctOptionIndex ?? row.correctOption ?? 0),
            marks: Number(row.marks ?? 1.0),
            negativeMarks: Number(row.negativeMarks ?? 0.25),
          };
        });

        console.log('Parsed Questions Ready to Store:', parsedQuestions);
        setQuestions(parsedQuestions);
        alert(`Successfully parsed ${parsedQuestions.length} questions from Excel!`);
      } catch (err) {
        console.error('Excel Parsing Error:', err);
        alert('Failed to parse Excel file.');
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Publish to Supabase
  const handlePublish = async () => {
    if (!title.trim()) return alert('Please enter a Mock Test Title');
    if (questions.length === 0) return alert('No questions loaded. Upload your Excel file first.');

    console.log('Publishing payload with', questions.length, 'questions...');

    const payload = {
      title: title.trim(),
      exam_type: examType,
      questions: questions,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('mock_tests').insert([payload]).select();

    if (error) {
      console.error('Supabase Insert Error:', error);
      alert(`Publishing failed: ${error.message}`);
    } else {
      console.log('Published Record:', data);
      alert(`🎉 Mock Test Published! Title: "${title}" with ${questions.length} questions.`);
      setTitle('');
      setQuestions([]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 bg-slate-50 min-h-screen text-slate-900">
      <h1 className="text-2xl font-bold text-slate-800">Mock Test Admin Portal</h1>

      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase text-slate-500">1. Test Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Title</label>
            <input
              type="text"
              placeholder="e.g. SBI PO Prelims - Test 01"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Exam Category</label>
            <input
              type="text"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase text-slate-500">2. Select Excel Spreadsheet (.xlsx)</h2>

        <div className="border-2 border-dashed border-slate-300 p-8 rounded-xl text-center bg-slate-50 hover:bg-slate-100 transition">
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleExcelUpload}
            id="excel-input"
            className="hidden"
          />
          <label htmlFor="excel-input" className="cursor-pointer space-y-2 block">
            <div className="text-4xl">📊</div>
            <span className="text-sm font-bold text-blue-600 block">
              {isUploading ? 'Parsing file...' : 'Click to Upload 100-Question Prelims Excel File'}
            </span>
          </label>
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">Parsed Questions: {questions.length}</h3>
          <p className="text-xs text-slate-500">
            {questions.length === 100 ? '✅ 100 Questions detected successfully!' : 'Ready for database insert.'}
          </p>
        </div>
        <button
          onClick={handlePublish}
          disabled={questions.length === 0}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition"
        >
          Publish Mock Test
        </button>
      </section>
    </div>
  );
}