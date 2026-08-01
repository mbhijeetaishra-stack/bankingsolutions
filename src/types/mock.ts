export type SubjectCategory = 'QUANT' | 'REASONING' | 'ENGLISH' | 'GA';

export interface Question {
  id: string;
  section: SubjectCategory;
  passageText?: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  marks: number;
  negativeMarks: number;
}

export interface SectionConfig {
  id: SubjectCategory;
  title: string;
  durationInSeconds: number;
  questions: Question[];
}

export interface UserAnswer {
  questionId: string;
  selectedOption: number | null;
  isMarkedForReview: boolean;
}