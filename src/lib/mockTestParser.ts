// ===========================================================================
// MOCK TEST WORD (.docx) & TEXT PARSER WITH IMAGE SUPPORT
// ===========================================================================

export interface ParsedMockQuestion {
  id: string;
  section: string;
  passageText: string;
  questionText: string;
  imageUrl?: string;
  solutionImageUrl?: string;
  options: string[];
  correctOptionIndex: number;
  marks: number;
  negativeMarks: number;
  explanation: string;
}

export interface ParsedMockTestResult {
  title?: string;
  duration?: number;
  totalMarks?: number;
  cutoff?: number;
  examType?: string;
  questions: ParsedMockQuestion[];
}

export function parseMockTestDocText(rawText: string, defaultTitle?: string): ParsedMockTestResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let title = defaultTitle || '';
  let duration = 60;
  let totalMarks = 100;
  let cutoff = 50;
  let examType = 'IBPS PO Prelims';

  // Check top lines for Title / Metadata
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const l = lines[i];

    if (/^(?:Title|Mock\s+Test|Exam)\s*[:\-]?\s*(.+)/i.test(l)) {
      const tm = l.match(/^(?:Title|Mock\s+Test|Exam)\s*[:\-]?\s*(.+)/i);
      if (tm && tm[1]) title = tm[1].trim();
    } else if (i === 0 && !l.startsWith('[') && !l.startsWith('Q') && l.length < 100) {
      if (!title) title = l.replace(/^[#\*\s]+/, '').replace(/[#\*]+$/, '').trim();
    }

    const durMatch = l.match(/(?:Duration|Time)\s*[:\-]?\s*(\d+)\s*(?:Mins|Minutes|Min)?/i);
    if (durMatch && durMatch[1]) duration = Number(durMatch[1]);

    const marksMatch = l.match(/(?:Total\s+Marks|Marks)\s*[:\-]?\s*(\d+)/i);
    if (marksMatch && marksMatch[1]) totalMarks = Number(marksMatch[1]);

    const cutoffMatch = l.match(/(?:Cut[\s\-]?off|Target\s+Cutoff)\s*[:\-]?\s*(\d+)/i);
    if (cutoffMatch && cutoffMatch[1]) cutoff = Number(cutoffMatch[1]);

    if (/IBPS\s+PO|SBI\s+PO|IBPS\s+CLERK|SBI\s+CLERK|RRB\s+PO|RRB\s+CLERK|RBI\s+GRADE\s+B/i.test(l)) {
      const em = l.match(/(IBPS\s+PO|SBI\s+PO|IBPS\s+CLERK|SBI\s+CLERK|RRB\s+PO|RRB\s+CLERK|RBI\s+GRADE\s+B(?:\s+(?:Prelims|Mains))?)/i);
      if (em && em[1]) examType = em[1].trim();
    }
  }

  const questions: ParsedMockQuestion[] = [];
  let currentSection = 'QUANT';
  let currentPassage = '';
  let passageEndQNum: number | null = null;

  let curQText = '';
  let curImageUrl: string | undefined = undefined;
  let curSolImageUrl: string | undefined = undefined;
  let curOpts: string[] = [];
  let curAns = 0;
  let curMarks = 1.0;
  let curNegative = 0.25;
  let curExp = '';
  let readingExp = false;

  function flushQuestion() {
    if (curQText.trim() && curOpts.length >= 2) {
      questions.push({
        id: `q-${questions.length + 1}-${Date.now()}`,
        section: currentSection,
        passageText: currentPassage.trim(),
        questionText: curQText.trim(),
        imageUrl: curImageUrl,
        solutionImageUrl: curSolImageUrl,
        options: curOpts.length >= 2 ? curOpts : ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'],
        correctOptionIndex: Math.min(Math.max(0, curAns), curOpts.length - 1),
        marks: curMarks,
        negativeMarks: curNegative,
        explanation: curExp.trim(),
      });
    }

    curQText = '';
    curImageUrl = undefined;
    curSolImageUrl = undefined;
    curOpts = [];
    curAns = 0;
    curMarks = 1.0;
    curNegative = 0.25;
    curExp = '';
    readingExp = false;
  }

  const sectionRegex = /^\[?\s*(?:SECTION\s*[:\-]?)?\s*(QUANT(?:ITATIVE\s+APTITUDE)?|MATH(?:S)?|REASONING(?:\s+ABILITY)?|ENG(?:LISH)?(?:\s+LANGUAGE)?|GA|CURRENT\s+AFFAIRS|GENERAL\s+AWARENESS|COMPUTER(?:\s+AWARENESS)?|HINDI)\s*\]?$/i;
  
  // Matches: Directions (Q1-Q5), [PASSAGE: Q1-Q5], [PUZZLE: Q6-Q10], [DI: Q1-Q5], Puzzle:, Data Interpretation:, Caselet:, RC:
  const directionStartRegex = /^\[?\s*(?:Directions?|Passage|Instructions?|Puzzle|Seating\s+Arrangement|Data\s+Interpretation|DI|Caselet|Reading\s+Comprehension|RC)\b(?:\s*[:\-]|\s*[\(\[][^\]\)]*[\)\]])?\s*[:\-]?\s*(.*)$/i;

  // Explicit marker to reset passage context for standalone questions
  const standaloneRegex = /^\[?\s*(?:END_PASSAGE|END_PUZZLE|END_DI|END_DIRECTION|END_SET|STANDALONE|SINGLE|STANDALONE_QUESTION)\s*\]?$/i;

  // Regex to extract question ranges like (Q1-Q5), (1-5), (Questions 1 to 5), (Q. 1 to 5), [Q1-Q5]
  const rangeRegex = /(?:[\(\[]\s*(?:Q(?:uestions?|\.)?\s*)?(\d+)\s*(?:-|to)\s*(?:Q(?:uestions?|\.)?\s*)?(\d+)\s*[\)\]]|(?:Q(?:uestions?|\.)?\s*)(\d+)\s*(?:-|to)\s*(?:Q(?:uestions?|\.)?\s*)(\d+))/i;

  const qStartRegex = /^(?:Q(?:uestion)?\s*[\.\:\)]?\s*(\d+)[\.\:\)]|\(?(\d+)\)[\.\)]|\b(\d+)[\.\)])\s*(.*)$/i;
  const optRegex = /^(?:[\(\[]?([A-Ea-e1-5])[\)\]\.\:]\s*)(.*)$/;
  const ansRegex = /^(?:Correct\s+(?:Option|Answer)|Answer|Ans)\s*[:\-\.]?\s*(?:Option\s*)?[\(\[]?([A-Ea-e1-5])/i;
  const marksRegex = /(?:Marks?|Marking)\s*[:\-]?\s*(?:\+)?([0-9\.]+)\s*(?:[\,\/\|\-]\s*(?:\-)?([0-9\.]+))?/i;
  const expRegex = /^(?:Explanation|Exp|Sol|Solution|Rationale)\s*[:\-\.]?\s*(.*)$/i;
  const solImgTagRegex = /(?:\[\s*(?:SOLUTION[_\s\-]?IMAGE|SOL[_\s\-]?IMAGE|SOLUTION[_\s\-]?GRAPH|SOLUTION[_\s\-]?DIAGRAM|SOLUTION)\s*[:\-]?\s*|(?:SOLUTION[_\s\-]?IMAGE|SOL[_\s\-]?IMAGE|SOLUTION[_\s\-]?GRAPH|SOLUTION[_\s\-]?DIAGRAM)\s*[:\-]?\s*|!\[(?:solution|sol|explanation)[^\]]*\]\()(https?:\/\/[^\s\]\)]+)\]?/i;
  const imgTagRegex = /(?:\[\s*(?:IMAGE|GRAPH|DIAGRAM)\s*[:\-]?\s*|(?:IMAGE|GRAPH|DIAGRAM)\s*[:\-]?\s*|!\[[^\]]*\]\()(https?:\/\/[^\s\]\)]+)\]?/i;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    // Ignore decorative separator lines
    if (/^[-=_\*]{3,}$/.test(l)) {
      continue;
    }

    // 1. Detect Section Switch
    const secMatch = l.match(sectionRegex);
    if (secMatch && secMatch[1]) {
      flushQuestion();
      const rawSec = secMatch[1].toUpperCase();
      if (rawSec.includes('ENG')) currentSection = 'ENGLISH';
      else if (rawSec.includes('REASON')) currentSection = 'REASONING';
      else if (rawSec.includes('QUANT') || rawSec.includes('MATH')) currentSection = 'QUANT';
      else if (rawSec.includes('GA') || rawSec.includes('CURRENT') || rawSec.includes('AWARE')) currentSection = 'GA';
      else if (rawSec.includes('COMP')) currentSection = 'COMPUTER';
      else if (rawSec.includes('HIN')) currentSection = 'HINDI';
      currentPassage = '';
      passageEndQNum = null;
      continue;
    }

    // 2. Detect Standalone Marker (Resets Passage Context)
    if (standaloneRegex.test(l)) {
      flushQuestion();
      currentPassage = '';
      passageEndQNum = null;
      continue;
    }

    // 3. Detect Directions / Passage / Puzzle / DI Block
    const dirMatch = l.match(directionStartRegex);
    if (dirMatch && !qStartRegex.test(l)) {
      flushQuestion();
      currentPassage = l;
      passageEndQNum = null;

      // Extract question range if specified (e.g. Q1-Q5, 1 to 5)
      const rangeMatch = l.match(rangeRegex);
      if (rangeMatch) {
        const endQ = parseInt(rangeMatch[2] || rangeMatch[4], 10);
        if (!isNaN(endQ)) {
          passageEndQNum = endQ;
        }
      }
      continue;
    }

    // 4. Question Start Line
    const qm = l.match(qStartRegex);
    if (qm) {
      flushQuestion();

      // Check if question number is past the declared passage range
      const rawQNum = qm[1] || qm[2] || qm[3];
      const parsedQNum = rawQNum ? parseInt(rawQNum, 10) : NaN;
      const effectiveQNum = !isNaN(parsedQNum) ? parsedQNum : (questions.length + 1);

      if (passageEndQNum !== null && effectiveQNum > passageEndQNum) {
        currentPassage = '';
        passageEndQNum = null;
      }

      curQText = (qm[4] || '').trim();

      // Check if line contains inline marks or image
      const inlineMarks = l.match(marksRegex);
      if (inlineMarks) {
        if (inlineMarks[1]) curMarks = Number(inlineMarks[1]);
        if (inlineMarks[2]) curNegative = Number(inlineMarks[2]);
      }
      const inlineImg = l.match(imgTagRegex);
      if (inlineImg && inlineImg[1]) {
        curImageUrl = inlineImg[1].trim();
      }
      continue;
    }

    // 5. Answer Line (often carries marks too: "Ans: (B) | Marks: +1, -0.25")
    const am = l.match(ansRegex);
    if (am) {
      const raw = am[1].toUpperCase();
      if (/[A-E]/.test(raw)) {
        curAns = raw.charCodeAt(0) - 'A'.charCodeAt(0);
      } else if (/[1-5]/.test(raw)) {
        curAns = Number(raw) - 1;
      }

      const inlineMarks = l.match(marksRegex);
      if (inlineMarks) {
        if (inlineMarks[1]) curMarks = Number(inlineMarks[1]);
        if (inlineMarks[2]) curNegative = Number(inlineMarks[2]);
      }
      continue;
    }

    // 6. Explicit Marks Line
    const mm = l.match(marksRegex);
    if (mm && (l.toLowerCase().includes('mark') || l.startsWith('+') || l.startsWith('Marks'))) {
      if (mm[1]) curMarks = Number(mm[1]);
      if (mm[2]) curNegative = Number(mm[2]);
      continue;
    }

    // 7. Explanation Start
    const em = l.match(expRegex);
    if (em) {
      readingExp = true;
      curExp = em[1] ? em[1].trim() : '';

      const solImg = l.match(solImgTagRegex);
      if (solImg && solImg[1]) {
        curSolImageUrl = solImg[1].trim();
      }
      continue;
    }

    // 8. Solution Image Reference Line (Checked first so solution tags are never misidentified as question graphs)
    const solImgLineMatch = l.match(solImgTagRegex);
    if (solImgLineMatch && solImgLineMatch[1]) {
      curSolImageUrl = solImgLineMatch[1].trim();
      continue;
    }

    // 9. General Question / Passage Image Reference Line
    const imgLineMatch = l.match(imgTagRegex);
    if (imgLineMatch && imgLineMatch[1]) {
      const imgUrl = imgLineMatch[1].trim();
      // If we are currently reading an explanation, any inline image is part of the solution!
      if (readingExp) {
        curSolImageUrl = imgUrl;
      } else if (!curQText && currentPassage) {
        // If we are currently reading a passage block before any question has started, attach image to Left Pane passage!
        currentPassage += `\n\n![Passage / DI Graph](${imgUrl})`;
      } else {
        curImageUrl = imgUrl;
      }
      continue;
    }

    // 9. Option Line
    const om = l.match(optRegex);
    if (om && !readingExp) {
      curOpts.push(om[2].trim());
      continue;
    }

    // 10. Continuation Lines
    if (readingExp) {
      curExp += (curExp ? ' ' : '') + l;
    } else if (curOpts.length === 0) {
      if (curQText) {
        curQText += ' ' + l;
      } else if (currentPassage) {
        // Multi-line passage continuation before Q1
        currentPassage += '\n' + l;
      }
    } else if (curOpts.length > 0) {
      curOpts[curOpts.length - 1] += ' ' + l;
    }
  }

  flushQuestion();

  return {
    title: title || defaultTitle || 'Full Mock Test Simulation',
    duration,
    totalMarks: questions.length > 0 ? questions.length * 1.0 : totalMarks,
    cutoff,
    examType,
    questions,
  };
}

export const SAMPLE_MOCK_FORMAT_TEXT = `Title: IBPS PO Prelims - Full Mock 01
Exam: IBPS PO Prelims
Duration: 60
Marks: 100
Cutoff: 58

[SECTION: QUANT]

Directions (Q1-Q2): Study the bar graph below which shows account openings in branches A, B, C, D, E.
[IMAGE: https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800]

Q1. What is the ratio of total savings accounts opened in branches A and B together to current accounts in C and D together?
(A) 4 : 5
(B) 5 : 6
(C) 7 : 8
(D) 3 : 4
(E) None of these
Ans: (B)
Marks: +1.0, -0.25
Explanation: Total in A and B = 600. Total in C and D = 720. Ratio = 600/720 = 5/6.

Q2. Total accounts opened in Branch E is what percentage more or less than Branch A?
(A) 15% more
(B) 20% less
(C) 25% more
(D) 30% more
(E) None of these
Ans: (C)
Marks: +1.0, -0.25
Explanation: Difference = ((500 - 400) / 400) * 100 = 25% more.

[STANDALONE]
Q3. Find the missing number in the series: 12, 26, 54, 110, 222, ?
(A) 442
(B) 444
(C) 446
(D) 448
(E) 450
Ans: (C)
Marks: +1.0, -0.25
Explanation: Pattern: *2 + 2 => 222 * 2 + 2 = 446.

[SECTION: REASONING]

[PUZZLE: Q4-Q5]
Directions (Q4-Q5): Eight persons — P, Q, R, S, T, U, V, and W — are sitting in a straight row facing North:
1. P sits third from one of the extreme ends.
2. Only two persons sit between P and T.
3. V sits immediate left of T.
4. W sits at the extreme left end of the row.

Q4. Who sits at the extreme left end of the row?
(A) S
(B) W
(C) R
(D) U
(E) Q
Ans: (B)
Marks: +1.0, -0.25
Explanation: W sits at the extreme left end based on clue 4.

Q5. How many persons sit between P and W?
(A) One
(B) Two
(C) Three
(D) Four
(E) None
Ans: (A)
Marks: +1.0, -0.25
Explanation: From the arrangement: W, R, P, V, T, U, S, Q, exactly one person (R) sits between P and W.

[SECTION: ENGLISH]

Directions (Q6-Q7): Read the passage and answer the questions that follow:
Central Bank Digital Currencies (CBDCs) are legal tender issued by a central bank in digital form. The Reserve Bank of India has piloted the Digital Rupee (e-Rupee) for wholesale and retail segments to reduce the physical logistics cost of managing cash and to boost nationwide financial inclusion.

Q6. What is a primary objective of introducing the Digital Rupee?
(A) To eliminate physical banks entirely
(B) To reduce cash management costs and boost financial inclusion
(C) To replace forex reserves with cryptocurrency
(D) To mandate commercial banks to stop lending
(E) None of these
Ans: (B)
Marks: +1.0, -0.25
Explanation: As directly stated in the passage, reducing cash logistics costs and boosting financial inclusion are core goals.

Q7. Choose the word most SIMILAR in meaning to "BOOST" as used in the passage:
(A) Restrict
(B) Enhance
(C) Dismantle
(D) Ignore
(E) Curtail
Ans: (B)
Marks: +1.0, -0.25
Explanation: 'Boost' means to help or encourage to increase or improve, which matches 'Enhance'.

[SECTION: GA]

Q8. Which organization releases the Financial Stability Report (FSR) in India?
(A) SEBI
(B) NITI Aayog
(C) Reserve Bank of India (RBI)
(D) Ministry of Finance
(E) NABARD
Ans: (C)
Marks: +1.0, -0.25
Explanation: The Reserve Bank of India (RBI) publishes the biannual Financial Stability Report (FSR).`;

