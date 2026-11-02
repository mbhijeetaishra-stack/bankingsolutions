const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const sampleQuestions = [
  {
    q: "Q1. Which regulatory body in India recently introduced the comprehensive regulatory framework on digital lending and unauthorized loan apps?",
    opts: [
      "(A) Securities and Exchange Board of India (SEBI)",
      "(B) Reserve Bank of India (RBI)",
      "(C) Insurance Regulatory and Development Authority (IRDAI)",
      "(D) Pension Fund Regulatory and Development Authority (PFRDA)",
      "(E) National Bank for Agriculture and Rural Development (NABARD)"
    ],
    ans: "Ans: (B)",
    exp: "Explanation: The Reserve Bank of India (RBI) issued regulatory guidelines for digital lending to protect borrowers from predatory lending practices, unauthorized apps, and unethical recovery tactics."
  },
  {
    q: "Q2. Who among the following has been appointed as the Executive Director for India at the International Monetary Fund (IMF)?",
    opts: [
      "(A) Raghuram Rajan",
      "(B) Viral Acharya",
      "(C) Urjit Patel",
      "(D) K.V. Subramanian",
      "(E) Arvind Subramanian"
    ],
    ans: "Ans: (D)",
    exp: "Explanation: Former Chief Economic Adviser K.V. Subramanian was appointed as the Executive Director (India) at the International Monetary Fund (IMF)."
  },
  {
    q: "Q3. What is the minimum Capital Adequacy Ratio (CAR) / Capital to Risk (Weighted) Assets Ratio (CRAR) required to be maintained by Scheduled Commercial Banks in India as per RBI Basel III norms?",
    opts: [
      "(A) 8.0%",
      "(B) 9.0%",
      "(C) 10.5%",
      "(D) 11.5%",
      "(E) 12.0%"
    ],
    ans: "Ans: (B)",
    exp: "Explanation: As per RBI's Basel III guidelines, Scheduled Commercial Banks in India are required to maintain a minimum Capital Adequacy Ratio (CAR) of 9.0% (excluding Capital Conservation Buffer)."
  },
  {
    q: "Q4. In which state was India's first international multi-modal logistics park developed under the Bharatmala Pariyojana?",
    opts: [
      "(A) Gujarat",
      "(B) Maharashtra",
      "(C) Assam",
      "(D) Tamil Nadu",
      "(E) Karnataka"
    ],
    ans: "Ans: (C)",
    exp: "Explanation: India's first international multi-modal logistics park (MMLP) was developed at Jogighopa in Assam under the flagship Bharatmala Pariyojana."
  },
  {
    q: "Q5. What is the current maximum transaction limit per day for Small Value Digital Payments in Offline Mode (UPI Lite) as revised by the Reserve Bank of India?",
    opts: [
      "(A) Rs. 1,000",
      "(B) Rs. 2,000",
      "(C) Rs. 5,000",
      "(D) Rs. 10,000",
      "(E) Rs. 20,000"
    ],
    ans: "Ans: (B)",
    exp: "Explanation: The overall limit for small value digital transactions in offline mode on a payment instrument is Rs. 2,000 at any point in time, with individual transaction cap of Rs. 500."
  },
  {
    q: "Q6. Which public sector bank launched the digital banking super-app named 'YONO' (You Only Need One)?",
    opts: [
      "(A) Punjab National Bank",
      "(B) Bank of Baroda",
      "(C) State Bank of India",
      "(D) Canara Bank",
      "(E) Union Bank of India"
    ],
    ans: "Ans: (C)",
    exp: "Explanation: State Bank of India (SBI) launched the integrated digital banking and lifestyle platform 'YONO' (You Only Need One)."
  },
  {
    q: "Q7. Who was named the recipient of the 2026 Saraswati Samman for outstanding literary contributions?",
    opts: [
      "(A) Prabha Varma",
      "(B) Ramdarash Mishra",
      "(C) Sharad Pagare",
      "(D) Vasdev Mohi",
      "(E) K. Siva Reddy"
    ],
    ans: "Ans: (A)",
    exp: "Explanation: Noted poet and author Prabha Varma was chosen for the Saraswati Samman instituted by the KK Birla Foundation."
  },
  {
    q: "Q8. In the Monetary Policy Committee (MPC) of the Reserve Bank of India, how many members are there in total?",
    opts: [
      "(A) 4",
      "(B) 5",
      "(C) 6",
      "(D) 7",
      "(E) 8"
    ],
    ans: "Ans: (C)",
    exp: "Explanation: The Monetary Policy Committee (MPC) consists of 6 members: 3 from the Reserve Bank of India (including the RBI Governor who acts as the ex-officio chairperson) and 3 external members appointed by the Central Government."
  },
  {
    q: "Q9. What is the statutory lock-in period for investments made in the Public Provident Fund (PPF) scheme in India?",
    opts: [
      "(A) 5 Years",
      "(B) 10 Years",
      "(C) 15 Years",
      "(D) 20 Years",
      "(E) 25 Years"
    ],
    ans: "Ans: (C)",
    exp: "Explanation: The Public Provident Fund (PPF) account has an initial statutory maturity period of 15 years, which can be extended in blocks of 5 years thereafter."
  },
  {
    q: "Q10. Where is the permanent headquarters of the Asian Infrastructure Investment Bank (AIIB) located?",
    opts: [
      "(A) Manila, Philippines",
      "(B) Beijing, China",
      "(C) Shanghai, China",
      "(D) Tokyo, Japan",
      "(E) Singapore"
    ],
    ans: "Ans: (B)",
    exp: "Explanation: The Asian Infrastructure Investment Bank (AIIB) is a multilateral development bank headquartered in Beijing, China, of which India is the second-largest shareholder."
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

async function generateSampleDocx() {
  const zip = new JSZip();

  // 1. [Content_Types].xml
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

  // 2. _rels/.rels
  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // 3. word/_rels/document.xml.rels
  zip.folder('word').folder('_rels').file(
    'document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. word/styles.xml
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

  // Build document paragraphs
  const today = new Date().toISOString().slice(0, 10);
  let paragraphsXml = '';

  function p(text, bold = false, size = 22, color = '000000') {
    const boldXml = bold ? '<w:b/>' : '';
    const colorXml = color !== '000000' ? `<w:color w:val="${color}"/>` : '';
    return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr>${boldXml}<w:sz w:val="${size}"/>${colorXml}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  }

  // Header
  paragraphsXml += p(`BSCA Daily Current Affairs & GA Quiz`, true, 32, '1E3A8A');
  paragraphsXml += p(`Date: ${today}`, true, 24, '475569');
  paragraphsXml += p(`--------------------------------------------------`, false, 20, '94A3B8');
  paragraphsXml += p(`Instructions: Each question has 5 options (A-E) followed by the correct answer and a brief explanation.`, false, 20, '64748B');
  paragraphsXml += p(``);

  for (const q of sampleQuestions) {
    paragraphsXml += p(q.q, true, 23, '0F172A');
    for (const opt of q.opts) {
      paragraphsXml += p(`  ${opt}`, false, 22, '1E293B');
    }
    paragraphsXml += p(q.ans, true, 22, '047857');
    paragraphsXml += p(q.exp, false, 21, '334155');
    paragraphsXml += p(``); // Blank line separator
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
  const outPath = path.join(__dirname, '..', 'public', 'samples', 'bsca_quiz_sample.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated sample docx: ${outPath} (${buffer.length} bytes)`);

  // Also write plain text format for easy viewing/copying
  let textSample = `BSCA Daily Current Affairs & GA Quiz\nDate: ${today}\n\n`;
  for (const q of sampleQuestions) {
    textSample += `${q.q}\n`;
    for (const opt of q.opts) {
      textSample += `${opt}\n`;
    }
    textSample += `${q.ans}\n`;
    textSample += `${q.exp}\n\n`;
  }
  const textOutPath = path.join(__dirname, '..', 'public', 'samples', 'bsca_quiz_sample.txt');
  fs.writeFileSync(textOutPath, textSample, 'utf-8');
  console.log(`Generated sample text: ${textOutPath}`);
}

generateSampleDocx().catch((err) => {
  console.error('Error generating sample docx:', err);
  process.exit(1);
});

