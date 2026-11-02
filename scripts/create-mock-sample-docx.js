const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const sampleMockQuestions = [
  // SECTION: QUANT
  {
    section: "QUANT",
    direction: "Directions (Q1-Q3): The bar graph shows the number of accounts (Savings and Current) opened in five different branches (A, B, C, D, E) of a public sector bank in October 2026. Study the data and answer the following questions. (Graph can be attached via Image Upload with Question Number).",
    q: "Q1. What is the ratio of total savings accounts opened in branches A and B together to the total current accounts opened in branches C and D together?",
    opts: [
      "(A) 4 : 5",
      "(B) 5 : 6",
      "(C) 7 : 8",
      "(D) 3 : 4",
      "(E) 8 : 9"
    ],
    ans: "Ans: (B)",
    marks: "Marks: +1, -0.25",
    exp: "Explanation: Total savings in A and B = 250 + 350 = 600. Total current in C and D = 320 + 400 = 720. Required ratio = 600 : 720 = 5 : 6."
  },
  {
    section: "QUANT",
    direction: "",
    q: "Q2. The total number of accounts opened in Branch E is what percentage more or less than the total accounts opened in Branch A?",
    opts: [
      "(A) 15% more",
      "(B) 20% less",
      "(C) 25% more",
      "(D) 30% more",
      "(E) 10% less"
    ],
    ans: "Ans: (C)",
    marks: "Marks: +1, -0.25",
    exp: "Explanation: Total in A = 400. Total in E = 500. Percentage difference = ((500 - 400) / 400) * 100 = 25% more."
  },
  {
    section: "QUANT",
    direction: "",
    q: "Q3. Find the missing number in the given series: 12, 26, 54, 110, 222, ?",
    opts: [
      "(A) 442",
      "(B) 444",
      "(C) 446",
      "(D) 448",
      "(E) 450"
    ],
    ans: "Ans: (C)",
    marks: "Marks: +1, -0.25",
    exp: "Explanation: Pattern: *2 + 2. 12*2 + 2 = 26; 26*2 + 2 = 54; 54*2 + 2 = 110; 110*2 + 2 = 222; 222*2 + 2 = 446."
  },

  // SECTION: REASONING
  {
    section: "REASONING",
    direction: "Directions (Q4-Q5): Eight professionals — P, Q, R, S, T, U, V, and W — are sitting in a straight row facing North, but not necessarily in the same order. P sits third from one of the extreme ends. Only two persons sit between P and T. V sits immediate left of T. (Arrangement diagram can be uploaded as Solution Image).",
    q: "Q4. Who sits at the extreme left end of the row?",
    opts: [
      "(A) S",
      "(B) W",
      "(C) R",
      "(D) U",
      "(E) Q"
    ],
    ans: "Ans: (B)",
    marks: "Marks: +1, -0.25",
    exp: "Explanation: Based on the seating clues: W sits at the extreme left, followed by R, P, V, T, U, S, and Q at the extreme right."
  },
  {
    section: "REASONING",
    direction: "",
    q: "Q5. In a certain code language, if 'BANKING' is coded as 'CBMLLOH', how will 'SOLUTIONS' be coded in that language?",
    opts: [
      "(A) TPMVUKPOT",
      "(B) TPMVTJNOR",
      "(C) TPNVUKPOT",
      "(D) UQNWVLQPU",
      "(E) RNLTSHNMS"
    ],
    ans: "Ans: (A)",
    marks: "Marks: +1, -0.25",
    exp: "Explanation: Each letter is shifted by +1 in alphabetical order: S->T, O->P, L->M, U->V, T->U, I->K(reversed), O->P, N->O, S->T."
  },

  // SECTION: ENGLISH
  {
    section: "ENGLISH",
    direction: "Directions (Q6-Q7): Read the passage and answer the questions: Central Bank Digital Currencies (CBDCs) are legal tender issued by a central bank in digital form. The Reserve Bank of India has piloted the Digital Rupee (e-Rupee) for wholesale and retail segments to reduce the physical cost of managing currency and foster financial inclusion.",
    q: "Q6. According to the passage, which of the following is a primary objective of launching the Digital Rupee (e-Rupee)?",
    opts: [
      "(A) To eliminate traditional bank branches completely",
      "(B) To lower the operational expenses of cash management and enhance financial inclusion",
      "(C) To replace international forex reserves with gold",
      "(D) To convert commercial banks into private NBFCs",
      "(E) To mandate crypto mining across public sector institutions"
    ],
    ans: "Ans: (B)",
    marks: "Marks: +1, -0.25",
    exp: "Explanation: The passage directly mentions reducing the physical cost of cash logistics and fostering financial inclusion as key goals."
  },
  {
    section: "ENGLISH",
    direction: "",
    q: "Q7. Choose the word most SIMILAR in meaning to 'FOSTER' as used in the passage:",
    opts: [
      "(A) Impede",
      "(B) Nurture",
      "(C) Dismantle",
      "(D) Ignore",
      "(E) Relinquish"
    ],
    ans: "Ans: (B)",
    marks: "Marks: +1, -0.25",
    exp: "Explanation: 'Foster' means to encourage development or growth, which is synonymous with 'Nurture'."
  },

  // SECTION: GA
  {
    section: "GA",
    direction: "",
    q: "Q8. Which regulatory authority in India oversees and regulates the National Pension System (NPS)?",
    opts: [
      "(A) SEBI",
      "(B) RBI",
      "(C) PFRDA",
      "(D) IRDAI",
      "(E) EPFO"
    ],
    ans: "Ans: (C)",
    marks: "Marks: +1, -0.25",
    exp: "Explanation: The Pension Fund Regulatory and Development Authority (PFRDA) is the statutory regulatory body governing the National Pension System (NPS)."
  }
];

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generateSampleMockDocx() {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.folder('word').folder('_rels').file(
    'document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.folder('word').file(
    'styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`
  );

  function p(text, bold = false, size = 22, color = '000000') {
    const boldXml = bold ? '<w:b/>' : '';
    const colorXml = color !== '000000' ? `<w:color w:val="${color}"/>` : '';
    return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr>${boldXml}<w:sz w:val="${size}"/>${colorXml}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  }

  let paragraphsXml = '';
  paragraphsXml += p(`BankingSolutions Full Mock Test Simulation (Sample Template)`, true, 30, '1E3A8A');
  paragraphsXml += p(`Exam Type: IBPS PO Prelims | Duration: 60 Minutes | Total Marks: 100`, true, 22, '475569');
  paragraphsXml += p(`-----------------------------------------------------------------------------------`, false, 20, '94A3B8');
  paragraphsXml += p(`Note: You can attach DI graph images or solution diagrams by Question Number in the upload portal!`, false, 20, 'D97706');
  paragraphsXml += p(``);

  let curSec = '';
  for (const q of sampleMockQuestions) {
    if (q.section !== curSec) {
      curSec = q.section;
      paragraphsXml += p(`[SECTION: ${curSec}]`, true, 26, '047857');
    }
    if (q.direction) {
      paragraphsXml += p(q.direction, false, 21, '475569');
    }
    paragraphsXml += p(q.q, true, 23, '0F172A');
    for (const opt of q.opts) {
      paragraphsXml += p(`  ${opt}`, false, 22, '1E293B');
    }
    paragraphsXml += p(`${q.ans} | ${q.marks}`, true, 22, '047857');
    paragraphsXml += p(q.exp, false, 21, '334155');
    paragraphsXml += p(``);
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml}
    <w:sectPr/>
  </w:body>
</w:document>`;

  zip.folder('word').file('document.xml', documentXml);

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const outDocxPath = path.join(__dirname, '..', 'public', 'samples', 'mock_test_sample.docx');
  fs.writeFileSync(outDocxPath, buffer);
  console.log(`Generated sample mock docx: ${outDocxPath} (${buffer.length} bytes)`);

  // Plain text version
  let textSample = `BankingSolutions Full Mock Test Simulation (Sample Template)\nExam Type: IBPS PO Prelims | Duration: 60 Minutes | Total Marks: 100\n\n`;
  curSec = '';
  for (const q of sampleMockQuestions) {
    if (q.section !== curSec) {
      curSec = q.section;
      textSample += `[SECTION: ${curSec}]\n\n`;
    }
    if (q.direction) {
      textSample += `${q.direction}\n\n`;
    }
    textSample += `${q.q}\n`;
    for (const opt of q.opts) {
      textSample += `${opt}\n`;
    }
    textSample += `${q.ans} | ${q.marks}\n`;
    textSample += `${q.exp}\n\n`;
  }
  const outTxtPath = path.join(__dirname, '..', 'public', 'samples', 'mock_test_sample.txt');
  fs.writeFileSync(outTxtPath, textSample, 'utf-8');
  console.log(`Generated sample mock text: ${outTxtPath}`);
}

generateSampleMockDocx().catch((err) => {
  console.error('Error generating sample mock docx:', err);
  process.exit(1);
});

