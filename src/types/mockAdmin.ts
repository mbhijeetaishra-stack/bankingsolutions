export type SubjectCategory = 'QUANT' | 'REASONING' | 'ENGLISH' | 'GA';

export interface QuestionItem {
  id?: string;
  section: SubjectCategory;
  passageText?: string; // Left Pane: Reading Comprehension, DI Sets, Puzzles, Directions
  questionText: string; // Right Pane: Individual Question
  options: string[];
  correctOptionIndex: number;
  marks: number;
  negativeMarks: number;
}

export interface SectionSetting {
  section: SubjectCategory;
  questionCount: number;
  durationMinutes: number;
}

export interface MockPublishPayload {
  title: string;
  examType: string;
  sections: SectionSetting[];
  questions: QuestionItem[];
}