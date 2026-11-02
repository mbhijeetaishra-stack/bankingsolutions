import { persistSettingToSupabase } from './monetization';
import { supabase } from './supabase';

export type WordMatrixMode =
  | 'banking_jargon'
  | 'editorial_definitions'
  | 'synonyms'
  | 'antonyms'
  | 'mixed';

export type MatchRelationType = 'JARGON' | 'DEFINITION' | 'SYNONYM' | 'ANTONYM';

export interface WordPair {
  id: string;
  term: string;
  match: string;
  relation: MatchRelationType;
  examNote: string;
  isCustom?: boolean;
  createdAt?: string;
}

export interface MatrixTile {
  tileId: string;
  pairId: string;
  kind: 'term' | 'match';
  text: string;
  relation: MatchRelationType;
}

export interface WordMatrixStats {
  gamesPlayed: number;
  boardsCleared: number;
  bestClearTimeMs: number | null;
  bestScore: number;
  currentWinStreak: number;
  bestWinStreak: number;
  masteredPairIds: string[];
  missedPairIds: string[];
}

export const WORD_MATRIX_STATS_KEY = 'bs_word_matrix_stats_v1';
export const WORD_MATRIX_CUSTOM_PAIRS_KEY = 'bs_word_matrix_custom_pairs_v1';

export const DEFAULT_WORD_MATRIX_STATS: WordMatrixStats = {
  gamesPlayed: 0,
  boardsCleared: 0,
  bestClearTimeMs: null,
  bestScore: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  masteredPairIds: [],
  missedPairIds: [],
};

// 1. FINANCIAL & BANKING AWARENESS JARGON (RBI / SBI / IBPS GA)
export const BANKING_JARGON_PAIRS: WordPair[] = [
  {
    id: 'bj_repo_rate',
    term: 'Repo Rate',
    match: 'Rate at which RBI lends short-term funds to banks against G-Secs',
    relation: 'JARGON',
    examNote: 'Primary policy rate decided by RBI MPC; raising Repo Rate curbs inflation by making borrowing costlier.',
  },
  {
    id: 'bj_reverse_repo',
    term: 'Reverse Repo',
    match: 'Rate at which RBI absorbs excess liquidity from commercial banks',
    relation: 'JARGON',
    examNote: 'Used alongside SDF (Standing Deposit Facility) by RBI to park surplus bank funds.',
  },
  {
    id: 'bj_haircut',
    term: 'Haircut',
    match: 'Percentage reduction on asset or loan value during collateral or IBC resolution',
    relation: 'JARGON',
    examNote: 'Creditors take a "haircut" when accepting less than the full outstanding loan amount under IBC.',
  },
  {
    id: 'bj_npa',
    term: 'NPA',
    match: 'Loan where interest or principal remains overdue for over 90 days',
    relation: 'JARGON',
    examNote: 'Classified further into Substandard (≤12m), Doubtful (>12m), and Loss Assets.',
  },
  {
    id: 'bj_camels',
    term: 'CAMELS Rating',
    match: 'Supervisory bank score: Capital, Assets, Management, Earnings, Liquidity, Sensitivity',
    relation: 'JARGON',
    examNote: 'Global supervisory framework used by regulators to assess overall financial health of banks.',
  },
  {
    id: 'bj_pca',
    term: 'PCA Framework',
    match: 'RBI watch-list curbs on weak banks breaching Capital, Asset or Leverage norms',
    relation: 'JARGON',
    examNote: 'Prompt Corrective Action restricts dividend distribution, branch expansion, and risky lending.',
  },
  {
    id: 'bj_casa',
    term: 'CASA Ratio',
    match: 'Share of low-cost Current and Savings deposits in total bank deposits',
    relation: 'JARGON',
    examNote: 'A higher CASA ratio lowers a bank’s cost of funds and improves Net Interest Margin (NIM).',
  },
  {
    id: 'bj_crar',
    term: 'CRAR (Basel III)',
    match: 'Capital-to-Risk Weighted Assets Ratio measuring bank loss-absorption cushion',
    relation: 'JARGON',
    examNote: 'RBI mandates minimum 9% CRAR (plus 2.5% Capital Conservation Buffer) for Indian scheduled commercial banks.',
  },
  {
    id: 'bj_crr',
    term: 'CRR',
    match: 'Share of NDTL banks must keep strictly as cash balance with RBI',
    relation: 'JARGON',
    examNote: 'Cash Reserve Ratio earns zero interest from RBI and directly controls banking liquidity.',
  },
  {
    id: 'bj_slr',
    term: 'SLR',
    match: 'Minimum % of NDTL banks hold in liquid cash, gold, or approved G-Secs',
    relation: 'JARGON',
    examNote: 'Statutory Liquidity Ratio is maintained by the bank itself under Section 24 of Banking Regulation Act.',
  },
  {
    id: 'bj_mclr',
    term: 'MCLR',
    match: 'Internal minimum lending rate floor based on marginal cost of funds',
    relation: 'JARGON',
    examNote: 'Introduced by RBI in 2016 to improve monetary policy transmission over the older Base Rate.',
  },
  {
    id: 'bj_moral_suasion',
    term: 'Moral Suasion',
    match: 'Qualitative RBI persuasion urging banks to follow policy without penalties',
    relation: 'JARGON',
    examNote: 'Informal credit control tool using letters, speeches, and meetings with bank chiefs.',
  },
  {
    id: 'bj_bancassurance',
    term: 'Bancassurance',
    match: 'Tie-up where a bank sells insurance policies through its branch network',
    relation: 'JARGON',
    examNote: 'Regulated jointly by RBI and IRDAI; generates fee-based non-interest income for banks.',
  },
  {
    id: 'bj_nostro',
    term: 'Nostro Account',
    match: 'Foreign-currency account held by an Indian bank in an overseas bank',
    relation: 'JARGON',
    examNote: 'Latin for "Our account with you" — e.g., SBI maintaining a USD account with Citibank New York.',
  },
  {
    id: 'bj_vostro',
    term: 'Vostro Account',
    match: 'Rupee (INR) account held by a foreign bank with a bank in India',
    relation: 'JARGON',
    examNote: 'Latin for "Your account with us" — key to RBI’s international trade settlement in INR.',
  },
  {
    id: 'bj_masala_bond',
    term: 'Masala Bonds',
    match: 'Rupee-denominated bonds issued offshore where investor bears currency risk',
    relation: 'JARGON',
    examNote: 'First issued by IFC; protects Indian borrowers from exchange-rate depreciation.',
  },
  {
    id: 'bj_wla',
    term: 'White Label ATM',
    match: 'ATMs owned and operated by non-bank NBFC entities authorized by RBI',
    relation: 'JARGON',
    examNote: 'Examples include Indicash (Tata Communications) and India1 Payments; carry no bank branding.',
  },
  {
    id: 'bj_sarfaesi',
    term: 'SARFAESI Act',
    match: 'Law allowing banks to seize and auction defaulter collateral without court trial',
    relation: 'JARGON',
    examNote: 'Enacted in 2002; applies to secured loans >₹1 lakh (excluding agricultural land).',
  },
  {
    id: 'bj_hypothecation',
    term: 'Hypothecation',
    match: 'Charge on movable asset (like a vehicle) where borrower keeps possession',
    relation: 'JARGON',
    examNote: 'Unlike Pledge (gold loan where bank keeps possession) or Mortgage (immovable property).',
  },
  {
    id: 'bj_garnishee',
    term: 'Garnishee Order',
    match: 'Court order instructing a bank to freeze funds in a judgment debtor’s account',
    relation: 'JARGON',
    examNote: 'Issued under Order 21 Rule 46 of CPC; bank acts as the "Garnishee".',
  },
  {
    id: 'bj_bail_in',
    term: 'Bail-in',
    match: 'Rescuing a failing bank by writing down bondholder or creditor claims internally',
    relation: 'JARGON',
    examNote: 'Opposite of a taxpayer-funded government "Bail-out" (e.g., AT-1 bond write-offs).',
  },
  {
    id: 'bj_moratorium',
    term: 'Moratorium',
    match: 'Authorized temporary holiday on loan EMI repayments during financial stress',
    relation: 'JARGON',
    examNote: 'Interest normally continues to accrue during a loan moratorium period.',
  },
  {
    id: 'bj_call_money',
    term: 'Call Money',
    match: 'Unsecured overnight inter-bank borrowing and lending for 1 day',
    relation: 'JARGON',
    examNote: '2 to 14 days is Notice Money; 15 days to 1 year in money market is Term Money.',
  },
  {
    id: 'bj_stagflation',
    term: 'Stagflation',
    match: 'Simultaneous economic stagnation, high unemployment, and high inflation',
    relation: 'JARGON',
    examNote: 'Breaks the normal Phillips Curve trade-off, posing a dilemma for central banks.',
  },
  {
    id: 'bj_green_shoe',
    term: 'Green Shoe Option',
    match: 'IPO clause letting underwriters allot extra shares to stabilize post-listing price',
    relation: 'JARGON',
    examNote: 'SEBI permits over-allotment up to 15% of issue size for price stabilization.',
  },
  {
    id: 'bj_letter_credit',
    term: 'Letter of Credit',
    match: 'Bank guarantee assuring an exporter of payment once shipment terms are met',
    relation: 'JARGON',
    examNote: 'Crucial trade-finance instrument eliminating counterparty trust risk in global trade.',
  },
  {
    id: 'bj_psl',
    term: 'PSL Norms',
    match: 'Mandatory 40% bank lending target toward Agriculture, MSMEs & weaker sections',
    relation: 'JARGON',
    examNote: 'Priority Sector Lending is 40% of ANBC for domestic commercial banks and 75% for RRBs/SFBs.',
  },
  {
    id: 'bj_sdf',
    term: 'SDF Rate',
    match: 'Collateral-free floor window for banks to park overnight liquidity with RBI',
    relation: 'JARGON',
    examNote: 'Standing Deposit Facility sits 25 bps below the Repo Rate in the LAF corridor.',
  },
];

// 2. EDITORIAL VOCABULARY DEFINITIONS (SBI PO / IBPS PO RC & CLOZE)
export const EDITORIAL_DEFINITION_PAIRS: WordPair[] = [
  {
    id: 'ed_ubiquitous',
    term: 'Ubiquitous',
    match: 'Present, appearing, or found everywhere simultaneously',
    relation: 'DEFINITION',
    examNote: 'E.g., "UPI payments have become ubiquitous across urban and rural India."',
  },
  {
    id: 'ed_pragmatic',
    term: 'Pragmatic',
    match: 'Dealing with things sensibly and realistically rather than theoretically',
    relation: 'DEFINITION',
    examNote: 'Frequently describes central bank policy Tone ("Pragmatic and data-driven").',
  },
  {
    id: 'ed_mitigate',
    term: 'Mitigate',
    match: 'Make something bad less severe, serious, or painful',
    relation: 'DEFINITION',
    examNote: 'Common collocation: "Mitigate systemic credit risk / climate impact."',
  },
  {
    id: 'ed_exacerbate',
    term: 'Exacerbate',
    match: 'Make an existing problem, crisis, or bad situation much worse',
    relation: 'DEFINITION',
    examNote: 'E.g., "Supply-chain shocks exacerbated food inflation."',
  },
  {
    id: 'ed_ephemeral',
    term: 'Ephemeral',
    match: 'Lasting for a very short time; transitory',
    relation: 'DEFINITION',
    examNote: 'From Greek ephemeros; opposite of enduring or perpetual.',
  },
  {
    id: 'ed_ostensible',
    term: 'Ostensible',
    match: 'Stated or appearing to be true, though not necessarily really so',
    relation: 'DEFINITION',
    examNote: 'Used when highlighting a surface-level excuse vs. hidden motive.',
  },
  {
    id: 'ed_recalcitrant',
    term: 'Recalcitrant',
    match: 'Stubbornly uncooperative attitude toward authority or discipline',
    relation: 'DEFINITION',
    examNote: 'E.g., "Strict penalties for recalcitrant wilful defaulters."',
  },
  {
    id: 'ed_sanguine',
    term: 'Sanguine',
    match: 'Optimistic or positive, especially in a difficult economic situation',
    relation: 'DEFINITION',
    examNote: 'Favourite RC tone option in SBI PO & IBPS PO Mains.',
  },
  {
    id: 'ed_pernicious',
    term: 'Pernicious',
    match: 'Having a harmful effect, especially in a gradual or subtle way',
    relation: 'DEFINITION',
    examNote: 'E.g., "The pernicious impact of high fiscal deficits on growth."',
  },
  {
    id: 'ed_bolster',
    term: 'Bolster',
    match: 'Support, strengthen, or reinforce a system or confidence',
    relation: 'DEFINITION',
    examNote: 'E.g., "Capital infusion to bolster public sector bank balance sheets."',
  },
  {
    id: 'ed_conundrum',
    term: 'Conundrum',
    match: 'A confusing and difficult problem or policy dilemma',
    relation: 'DEFINITION',
    examNote: 'E.g., "The growth-inflation conundrum facing monetary policymakers."',
  },
  {
    id: 'ed_headwinds',
    term: 'Headwinds',
    match: 'External forces or conditions that slow down economic progress',
    relation: 'DEFINITION',
    examNote: 'Opposite of "Tailwinds" (favorable conditions boosting growth).',
  },
  {
    id: 'ed_austerity',
    term: 'Austerity',
    match: 'Strict government cuts in public spending to reduce budget deficits',
    relation: 'DEFINITION',
    examNote: 'Economic policy term frequently tested in financial editorials.',
  },
  {
    id: 'ed_proliferate',
    term: 'Proliferate',
    match: 'Increase rapidly in numbers; multiply swiftly',
    relation: 'DEFINITION',
    examNote: 'E.g., "Unregulated digital lending apps proliferated during the pandemic."',
  },
  {
    id: 'ed_equivocal',
    term: 'Equivocal',
    match: 'Open to more than one interpretation; intentionally vague',
    relation: 'DEFINITION',
    examNote: 'Opposite of "Unequivocal" (leaving no doubt; crystal clear).',
  },
  {
    id: 'ed_beleaguered',
    term: 'Beleaguered',
    match: 'In a very difficult situation; plagued by troubles or losses',
    relation: 'DEFINITION',
    examNote: 'E.g., "Rescue package for the beleaguered telecom operator."',
  },
  {
    id: 'ed_stringent',
    term: 'Stringent',
    match: 'Strict, precise, and exacting regarding rules or regulations',
    relation: 'DEFINITION',
    examNote: 'E.g., "RBI introduced stringent KYC and provisioning norms."',
  },
  {
    id: 'ed_nascent',
    term: 'Nascent',
    match: 'Just coming into existence and beginning to show future potential',
    relation: 'DEFINITION',
    examNote: 'E.g., "India’s nascent green hydrogen and sovereign green bond market."',
  },
  {
    id: 'ed_complacent',
    term: 'Complacent',
    match: 'Uncritically self-satisfied while unaware of potential danger',
    relation: 'DEFINITION',
    examNote: 'Do not confuse with "Complaisant" (willing to please others).',
  },
  {
    id: 'ed_alleviate',
    term: 'Alleviate',
    match: 'Make suffering, deficiency, or rural distress less severe',
    relation: 'DEFINITION',
    examNote: 'Targeted welfare schemes aim to alleviate poverty.',
  },
  {
    id: 'ed_precarious',
    term: 'Precarious',
    match: 'Not securely held; dangerously likely to collapse or falter',
    relation: 'DEFINITION',
    examNote: 'E.g., "Countries with precarious foreign exchange reserves."',
  },
  {
    id: 'ed_galvanize',
    term: 'Galvanize',
    match: 'Shock or excite someone into taking immediate decisive action',
    relation: 'DEFINITION',
    examNote: 'Figurative editorial verb meaning to spur into action.',
  },
  {
    id: 'ed_watershed',
    term: 'Watershed',
    match: 'A historic turning point marking a major shift in course',
    relation: 'DEFINITION',
    examNote: 'E.g., "The 1991 LPG reforms were a watershed moment for India."',
  },
  {
    id: 'ed_caveat',
    term: 'Caveat',
    match: 'A warning or proviso of specific stipulations or limitations',
    relation: 'DEFINITION',
    examNote: 'From Latin "may he beware" (as in Caveat Emptor — buyer beware).',
  },
];

// 3. HIGH-YIELD SYNONYMS
export const SYNONYM_PAIRS: WordPair[] = [
  { id: 'syn_candor', term: 'Candor', match: 'Frankness & Honesty', relation: 'SYNONYM', examNote: 'Speaking with open, sincere directness.' },
  { id: 'syn_capricious', term: 'Capricious', match: 'Fickle & Unpredictable', relation: 'SYNONYM', examNote: 'Given to sudden, unaccountable changes of mood or behavior.' },
  { id: 'syn_abate', term: 'Abate', match: 'Subside & Diminish', relation: 'SYNONYM', examNote: 'Become less intense or widespread (e.g., inflationary pressures abated).' },
  { id: 'syn_fastidious', term: 'Fastidious', match: 'Meticulous & Scrupulous', relation: 'SYNONYM', examNote: 'Very attentive to and concerned about accuracy and detail.' },
  { id: 'syn_cogent', term: 'Cogent', match: 'Convincing & Logical', relation: 'SYNONYM', examNote: 'Clear, logical, and persuasive argument.' },
  { id: 'syn_audacious', term: 'Audacious', match: 'Bold & Daring', relation: 'SYNONYM', examNote: 'Showing willingness to take surprisingly bold risks.' },
  { id: 'syn_parsimonious', term: 'Parsimonious', match: 'Stingy & Tight-fisted', relation: 'SYNONYM', examNote: 'Extremely unwilling to spend money or use resources.' },
  { id: 'syn_magnanimous', term: 'Magnanimous', match: 'Generous & Forgiving', relation: 'SYNONYM', examNote: 'Noble and generous, especially toward a rival.' },
  { id: 'syn_tenacious', term: 'Tenacious', match: 'Persistent & Determined', relation: 'SYNONYM', examNote: 'Holding fast; not readily letting go of a goal.' },
  { id: 'syn_ebullient', term: 'Ebullient', match: 'Cheerful & Exuberant', relation: 'SYNONYM', examNote: 'Overflowing with enthusiasm (e.g., ebullient equity markets).' },
  { id: 'syn_clandestine', term: 'Clandestine', match: 'Covert & Secretive', relation: 'SYNONYM', examNote: 'Kept secret or done illicitly.' },
  { id: 'syn_impeccable', term: 'Impeccable', match: 'Flawless & Faultless', relation: 'SYNONYM', examNote: 'In accordance with the highest standards; without fault.' },
  { id: 'syn_belligerent', term: 'Belligerent', match: 'Hostile & Aggressive', relation: 'SYNONYM', examNote: 'Eager to fight; combative tone.' },
  { id: 'syn_diligent', term: 'Diligent', match: 'Industrious & Assiduous', relation: 'SYNONYM', examNote: 'Showing care and conscientiousness in one’s work.' },
  { id: 'syn_obsolete', term: 'Obsolete', match: 'Outdated & Archaic', relation: 'SYNONYM', examNote: 'No longer produced or used; replaced by newer technology.' },
  { id: 'syn_plausible', term: 'Plausible', match: 'Credible & Believable', relation: 'SYNONYM', examNote: 'Seeming reasonable or probable.' },
  { id: 'syn_reticent', term: 'Reticent', match: 'Reserved & Uncommunicative', relation: 'SYNONYM', examNote: 'Not revealing one’s thoughts or feelings readily.' },
  { id: 'syn_voracious', term: 'Voracious', match: 'Insatiable & Eager', relation: 'SYNONYM', examNote: 'Engaging in an activity with great eagerness (e.g., voracious reader).' },
  { id: 'syn_astute', term: 'Astute', match: 'Shrewd & Perceptive', relation: 'SYNONYM', examNote: 'Having sharp judgment in assessing people or financial situations.' },
  { id: 'syn_copious', term: 'Copious', match: 'Abundant & Plentiful', relation: 'SYNONYM', examNote: 'Abundant in supply or quantity.' },
];

// 4. HIGH-YIELD ANTONYMS
export const ANTONYM_PAIRS: WordPair[] = [
  { id: 'ant_prolific', term: 'Prolific', match: 'Opposite: Barren / Unproductive', relation: 'ANTONYM', examNote: 'Prolific means highly productive; its antonym is Barren.' },
  { id: 'ant_benevolent', term: 'Benevolent', match: 'Opposite: Malevolent / Cruel', relation: 'ANTONYM', examNote: 'Benevolent = well-meaning & kindly; Malevolent = wishing harm.' },
  { id: 'ant_affluent', term: 'Affluent', match: 'Opposite: Destitute / Impoverished', relation: 'ANTONYM', examNote: 'Affluent = wealthy; Destitute = lacking basic necessities.' },
  { id: 'ant_opaque', term: 'Opaque', match: 'Opposite: Transparent / Lucid', relation: 'ANTONYM', examNote: 'Opaque pricing hides fees; Transparent pricing reveals everything.' },
  { id: 'ant_frugal', term: 'Frugal', match: 'Opposite: Extravagant / Lavish', relation: 'ANTONYM', examNote: 'Frugal = thrifty & economical; Extravagant = wasteful spending.' },
  { id: 'ant_verbose', term: 'Verbose', match: 'Opposite: Concise / Succinct', relation: 'ANTONYM', examNote: 'Verbose = wordy; Succinct/Concise = brief and clearly expressed.' },
  { id: 'ant_ambiguous', term: 'Ambiguous', match: 'Opposite: Explicit / Clear-cut', relation: 'ANTONYM', examNote: 'Ambiguous = unclear; Explicit = stated clearly in detail.' },
  { id: 'ant_dormant', term: 'Dormant', match: 'Opposite: Active / Operative', relation: 'ANTONYM', examNote: 'A bank account with no customer transactions for 24 months becomes Dormant.' },
  { id: 'ant_nadir', term: 'Nadir', match: 'Opposite: Zenith / Peak', relation: 'ANTONYM', examNote: 'Nadir = lowest point; Zenith/Acme = highest point.' },
  { id: 'ant_prudent', term: 'Prudent', match: 'Opposite: Reckless / Imprudent', relation: 'ANTONYM', examNote: 'Prudent = acting with care for the future; Reckless = heedless of danger.' },
  { id: 'ant_superfluous', term: 'Superfluous', match: 'Opposite: Essential / Necessary', relation: 'ANTONYM', examNote: 'Superfluous = unnecessary, more than enough.' },
  { id: 'ant_autonomous', term: 'Autonomous', match: 'Opposite: Dependent / Subordinate', relation: 'ANTONYM', examNote: 'Autonomous institutions govern themselves independently.' },
  { id: 'ant_concord', term: 'Concord', match: 'Opposite: Discord / Conflict', relation: 'ANTONYM', examNote: 'Concord = harmony & agreement; Discord = disagreement.' },
  { id: 'ant_gregarious', term: 'Gregarious', match: 'Opposite: Reclusive / Solitary', relation: 'ANTONYM', examNote: 'Gregarious = sociable; Reclusive = avoiding company.' },
  { id: 'ant_lucrative', term: 'Lucrative', match: 'Opposite: Unprofitable / Loss-making', relation: 'ANTONYM', examNote: 'Lucrative = producing a great deal of profit.' },
  { id: 'ant_volatile', term: 'Volatile', match: 'Opposite: Stable / Steady', relation: 'ANTONYM', examNote: 'Volatile markets fluctuate rapidly and unpredictably.' },
  { id: 'ant_indigenous', term: 'Indigenous', match: 'Opposite: Foreign / Imported', relation: 'ANTONYM', examNote: 'Indigenous = originating naturally in a country (e.g., RuPay).' },
  { id: 'ant_mundane', term: 'Mundane', match: 'Opposite: Extraordinary / Exciting', relation: 'ANTONYM', examNote: 'Mundane = humdrum, dull, everyday.' },
  { id: 'ant_stringent', term: 'Stringent', match: 'Opposite: Lenient / Lax', relation: 'ANTONYM', examNote: 'Stringent = strict; Lax/Lenient = permissive or relaxed.' },
  { id: 'ant_bolster', term: 'Bolster', match: 'Opposite: Undermine / Weaken', relation: 'ANTONYM', examNote: 'Bolster = strengthen; Undermine = erode the base of.' },
];

export function normalizeRelationType(
  raw?: string | null,
  fallback: MatchRelationType = 'JARGON'
): MatchRelationType {
  if (!raw) return fallback;
  const upper = raw.trim().toUpperCase();
  if (upper.includes('JARGON') || upper.includes('BANK') || upper.includes('FINANC')) {
    return 'JARGON';
  }
  if (upper.includes('SYN')) return 'SYNONYM';
  if (upper.includes('ANT') || upper.includes('OPP')) return 'ANTONYM';
  if (
    upper.includes('DEF') ||
    upper.includes('MEAN') ||
    upper.includes('EDIT') ||
    upper.includes('VOCAB')
  ) {
    return 'DEFINITION';
  }
  return fallback;
}

export function parseCustomWordPairs(raw: string | null): WordPair[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const valid: WordPair[] = [];
    parsed.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const rec = item as Partial<WordPair>;
      const term = typeof rec.term === 'string' ? rec.term.trim() : '';
      const match = typeof rec.match === 'string' ? rec.match.trim() : '';
      if (!term || !match) return;
      valid.push({
        id: typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `custom_wm_${idx}`,
        term,
        match,
        relation: normalizeRelationType(rec.relation, 'JARGON'),
        examNote:
          typeof rec.examNote === 'string' && rec.examNote.trim()
            ? rec.examNote.trim()
            : `${term} ↔ ${match}`,
        isCustom: true,
        createdAt: typeof rec.createdAt === 'string' ? rec.createdAt : undefined,
      });
    });
    return valid;
  } catch {
    return [];
  }
}

export function getCustomWordPairs(): WordPair[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseCustomWordPairs(localStorage.getItem(WORD_MATRIX_CUSTOM_PAIRS_KEY));
  } catch {
    return [];
  }
}

export async function saveCustomWordPairs(pairs: WordPair[]): Promise<void> {
  const normalized = pairs.map((p) => ({
    ...p,
    isCustom: true,
  }));
  const serialized = JSON.stringify(normalized);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(WORD_MATRIX_CUSTOM_PAIRS_KEY, serialized);
      window.dispatchEvent(new Event('bs_word_matrix_sync'));
    } catch {
      // Ignore storage quota errors
    }
  }
  await persistSettingToSupabase(WORD_MATRIX_CUSTOM_PAIRS_KEY, serialized);
}

export async function syncCustomWordPairsFromSupabase(): Promise<WordPair[]> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', WORD_MATRIX_CUSTOM_PAIRS_KEY)
      .maybeSingle();

    if (!error && data && data.setting_value) {
      const rawStr =
        typeof data.setting_value === 'string'
          ? data.setting_value
          : JSON.stringify(data.setting_value);
      const parsed = parseCustomWordPairs(rawStr);
      if (typeof window !== 'undefined') {
        localStorage.setItem(WORD_MATRIX_CUSTOM_PAIRS_KEY, JSON.stringify(parsed));
        window.dispatchEvent(new Event('bs_word_matrix_sync'));
      }
      return parsed;
    }
  } catch {
    // Fallback to localStorage
  }
  return getCustomWordPairs();
}

export function getBuiltInPoolForMode(mode: WordMatrixMode): WordPair[] {
  switch (mode) {
    case 'banking_jargon':
      return BANKING_JARGON_PAIRS;
    case 'editorial_definitions':
      return EDITORIAL_DEFINITION_PAIRS;
    case 'synonyms':
      return SYNONYM_PAIRS;
    case 'antonyms':
      return ANTONYM_PAIRS;
    case 'mixed':
      return [
        ...BANKING_JARGON_PAIRS,
        ...EDITORIAL_DEFINITION_PAIRS,
        ...SYNONYM_PAIRS,
        ...ANTONYM_PAIRS,
      ];
  }
}

export function getPoolForMode(
  mode: WordMatrixMode,
  customPairsInput?: WordPair[]
): WordPair[] {
  const customPairs = customPairsInput ?? getCustomWordPairs();
  const matchingCustom = customPairs.filter((p) => {
    if (mode === 'mixed') return true;
    if (mode === 'banking_jargon') return p.relation === 'JARGON';
    if (mode === 'editorial_definitions') return p.relation === 'DEFINITION';
    if (mode === 'synonyms') return p.relation === 'SYNONYM';
    if (mode === 'antonyms') return p.relation === 'ANTONYM';
    return true;
  });

  const builtIn = getBuiltInPoolForMode(mode);
  const customTermsLower = new Set(matchingCustom.map((c) => `${c.relation}:${c.term.toLowerCase()}`));
  const dedupedBuiltIn = builtIn.filter(
    (b) => !customTermsLower.has(`${b.relation}:${b.term.toLowerCase()}`)
  );

  return [...matchingCustom, ...dedupedBuiltIn];
}

export const SAMPLE_WORD_MATRIX_DOC_TEXT = `============================================================
WORD MATRIX BULK UPLOAD SAMPLE (MS WORD .DOCX OR .TXT)
============================================================
You can use EITHER Block Format OR One-Line Format (::):

Category: JARGON
Term: Liquidity Coverage Ratio (LCR)
Match: High-quality liquid assets banks hold to survive a 30-day cash stress scenario
Note: Mandated under Basel III norms to prevent short-term liquidity crises.

Category: JARGON
Term: Ways and Means Advances (WMA)
Match: Temporary RBI overdraft facility to bridge Govt revenue-expenditure mismatches
Note: Introduced in 1997 to replace ad-hoc Treasury Bills for Centre and States.

Category: DEFINITION
Term: Ameliorate
Match: Make something unsatisfactory or painful noticeably better
Note: High-frequency editorial verb ("Policy steps to ameliorate rural distress").

Category: SYNONYM
Term: Inadvertent
Match: Unintentional & Accidental
Note: Often used in banking compliance ("An inadvertent clerical oversight").

Category: ANTONYM
Term: Ephemeral
Match: Opposite: Perpetual / Enduring
Note: Ephemeral = short-lived; Perpetual = lasting forever.

# Quick One-Line Format (Term :: Match :: Exam Note :: Category):
 Viability Gap Funding :: Capital grant supporting economically vital but financially unviable infra projects :: Helps PPP highway and metro projects attract private bidders :: JARGON
`;

/**
 * Parses either structured multi-line blocks (Term:/Match:/Note:/Category:)
 * or quick "::" / "|" delimited lines from MS Word (.docx), .txt, or pasted text.
 */
export function parseWordMatrixBulkText(
  rawText: string,
  defaultRelation: MatchRelationType = 'JARGON'
): WordPair[] {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim());

  const results: WordPair[] = [];
  let currentCategory: MatchRelationType = defaultRelation;
  let currentTerm = '';
  let currentMatch = '';
  let currentNote = '';

  const flushBlock = () => {
    if (currentTerm.trim() && currentMatch.trim()) {
      results.push({
        id: `custom_${Date.now()}_${results.length}_${Math.random().toString(36).slice(2, 7)}`,
        term: currentTerm.trim(),
        match: currentMatch.trim(),
        relation: currentCategory,
        examNote:
          currentNote.trim() ||
          `${currentTerm.trim()} → ${currentMatch.trim()}`,
        isCustom: true,
        createdAt: new Date().toISOString(),
      });
    }
    currentTerm = '';
    currentMatch = '';
    currentNote = '';
  };

  for (const line of lines) {
    if (!line || line.startsWith('#') || line.startsWith('===')) {
      continue;
    }

    // Check quick "::" delimited one-liner
    if (line.includes('::')) {
      flushBlock();
      const parts = line.split('::').map((p) => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        const rel = parts[3] ? normalizeRelationType(parts[3], defaultRelation) : currentCategory;
        results.push({
          id: `custom_${Date.now()}_${results.length}_${Math.random().toString(36).slice(2, 7)}`,
          term: parts[0],
          match: parts[1],
          examNote: parts[2] || `${parts[0]} → ${parts[1]}`,
          relation: rel,
          isCustom: true,
          createdAt: new Date().toISOString(),
        });
      }
      continue;
    }

    const catMatch = line.match(/^(?:Category|Mode|Type)\s*:\s*(.+)$/i);
    if (catMatch) {
      if (currentTerm && currentMatch) flushBlock();
      currentCategory = normalizeRelationType(catMatch[1], defaultRelation);
      continue;
    }

    const termMatch = line.match(/^(?:Term|Word|\d+[.)]\s*Term|\d+[.)]\s*Word)\s*:\s*(.+)$/i);
    if (termMatch) {
      if (currentTerm && currentMatch) flushBlock();
      currentTerm = termMatch[1].trim();
      continue;
    }

    const matchLine = line.match(
      /^(?:Match|Meaning|Definition|Synonym|Antonym|Answer)\s*:\s*(.+)$/i
    );
    if (matchLine) {
      currentMatch = matchLine[1].trim();
      continue;
    }

    const noteLine = line.match(/^(?:Note|Exam\s*Note|Explanation|Example|Hint)\s*:\s*(.+)$/i);
    if (noteLine) {
      currentNote = noteLine[1].trim();
      flushBlock();
      continue;
    }
  }

  flushBlock();
  return results;
}

export function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Deals 8 unique WordPairs from the chosen mode and builds a 16-tile shuffled 4x4 Matrix.
 */
export function buildMatrixRound(
  mode: WordMatrixMode,
  fixedPairs?: WordPair[],
  customPairsInput?: WordPair[]
): { pairs: WordPair[]; tiles: MatrixTile[] } {
  const selectedPairs =
    fixedPairs && fixedPairs.length === 8
      ? fixedPairs
      : shuffleArray(getPoolForMode(mode, customPairsInput)).slice(0, 8);

  const rawTiles: MatrixTile[] = [];
  selectedPairs.forEach((pair) => {
    rawTiles.push({
      tileId: `${pair.id}__term`,
      pairId: pair.id,
      kind: 'term',
      text: pair.term,
      relation: pair.relation,
    });
    rawTiles.push({
      tileId: `${pair.id}__match`,
      pairId: pair.id,
      kind: 'match',
      text: pair.match,
      relation: pair.relation,
    });
  });

  return {
    pairs: selectedPairs,
    tiles: shuffleArray(rawTiles),
  };
}

export function loadWordMatrixStats(): WordMatrixStats {
  if (typeof window === 'undefined') return DEFAULT_WORD_MATRIX_STATS;
  try {
    const raw = localStorage.getItem(WORD_MATRIX_STATS_KEY);
    if (!raw) return DEFAULT_WORD_MATRIX_STATS;
    const parsed = JSON.parse(raw) as Partial<WordMatrixStats>;
    return {
      gamesPlayed: typeof parsed.gamesPlayed === 'number' ? parsed.gamesPlayed : 0,
      boardsCleared: typeof parsed.boardsCleared === 'number' ? parsed.boardsCleared : 0,
      bestClearTimeMs: typeof parsed.bestClearTimeMs === 'number' ? parsed.bestClearTimeMs : null,
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      currentWinStreak: typeof parsed.currentWinStreak === 'number' ? parsed.currentWinStreak : 0,
      bestWinStreak: typeof parsed.bestWinStreak === 'number' ? parsed.bestWinStreak : 0,
      masteredPairIds: Array.isArray(parsed.masteredPairIds) ? parsed.masteredPairIds : [],
      missedPairIds: Array.isArray(parsed.missedPairIds) ? parsed.missedPairIds : [],
    };
  } catch {
    return DEFAULT_WORD_MATRIX_STATS;
  }
}

export function saveWordMatrixStats(stats: WordMatrixStats): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WORD_MATRIX_STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota errors
  }
}

// =========================================================================
// 🏆 WORD MATRIX GLOBAL LEADERBOARD (TOP 100 + INDIVIDUAL PROFILE RANK)
// =========================================================================

export interface WordMatrixLeaderboardEntry {
  userId: string;
  name: string;
  targetExam: string;
  bestScore: number;
  bestClearTimeMs: number | null;
  boardsCleared: number;
  bestWinStreak: number;
  updatedAt: string;
}

export const WORD_MATRIX_LEADERBOARD_KEY = 'bs_word_matrix_leaderboard_v1';
export const WORD_MATRIX_GUEST_ID_KEY = 'bs_word_matrix_guest_id_v1';
export const WORD_MATRIX_PLAYER_NAME_KEY = 'bs_word_matrix_player_name_v1';

export function sortWordMatrixLeaderboard(
  entries: readonly WordMatrixLeaderboardEntry[]
): WordMatrixLeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
    const timeA = a.bestClearTimeMs ?? 999_999;
    const timeB = b.bestClearTimeMs ?? 999_999;
    if (timeA !== timeB) return timeA - timeB;
    if (b.boardsCleared !== a.boardsCleared) return b.boardsCleared - a.boardsCleared;
    return b.bestWinStreak - a.bestWinStreak;
  });
}

export function parseWordMatrixLeaderboard(raw: string | null): WordMatrixLeaderboardEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }
    const valid: WordMatrixLeaderboardEntry[] = [];
    parsed.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const rec = item as Partial<WordMatrixLeaderboardEntry>;
      const id = typeof rec.userId === 'string' ? rec.userId.trim() : '';
      // Exclude any synthetic seed entries; keep only real Word Matrix players with score > 0
      if (!id || id.startsWith('wm_seed_')) return;
      const score = typeof rec.bestScore === 'number' ? rec.bestScore : 0;
      if (score <= 0) return;

      valid.push({
        userId: id,
        name: typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : 'Banking Aspirant',
        targetExam:
          typeof rec.targetExam === 'string' && rec.targetExam.trim()
            ? rec.targetExam.trim()
            : 'Banking Exams 2026',
        bestScore: score,
        bestClearTimeMs: typeof rec.bestClearTimeMs === 'number' ? rec.bestClearTimeMs : null,
        boardsCleared: typeof rec.boardsCleared === 'number' ? rec.boardsCleared : 0,
        bestWinStreak: typeof rec.bestWinStreak === 'number' ? rec.bestWinStreak : 0,
        updatedAt:
          typeof rec.updatedAt === 'string' ? rec.updatedAt : new Date(0).toISOString(),
      });
    });

    return sortWordMatrixLeaderboard(valid);
  } catch {
    return [];
  }
}

export function getWordMatrixLeaderboard(): WordMatrixLeaderboardEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return parseWordMatrixLeaderboard(localStorage.getItem(WORD_MATRIX_LEADERBOARD_KEY));
  } catch {
    return [];
  }
}

export function getOrCreateGuestPlayerId(): string {
  if (typeof window === 'undefined') return 'guest_ssr';
  try {
    const existing = localStorage.getItem(WORD_MATRIX_GUEST_ID_KEY);
    if (existing && existing.trim()) return existing.trim();
    const created = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(WORD_MATRIX_GUEST_ID_KEY, created);
    return created;
  } catch {
    return 'guest_local';
  }
}

function mergeTwoLeaderboardLists(
  listA: WordMatrixLeaderboardEntry[],
  listB: WordMatrixLeaderboardEntry[]
): WordMatrixLeaderboardEntry[] {
  const map = new Map<string, WordMatrixLeaderboardEntry>();
  [...listA, ...listB].forEach((entry) => {
    if (!entry.userId || entry.userId.startsWith('wm_seed_') || entry.bestScore <= 0) {
      return;
    }
    const prev = map.get(entry.userId);
    if (!prev) {
      map.set(entry.userId, entry);
      return;
    }
    const fasterTime =
      prev.bestClearTimeMs !== null && entry.bestClearTimeMs !== null
        ? Math.min(prev.bestClearTimeMs, entry.bestClearTimeMs)
        : prev.bestClearTimeMs ?? entry.bestClearTimeMs;

    map.set(entry.userId, {
      userId: entry.userId,
      name: entry.updatedAt >= prev.updatedAt ? entry.name : prev.name,
      targetExam: entry.updatedAt >= prev.updatedAt ? entry.targetExam : prev.targetExam,
      bestScore: Math.max(prev.bestScore, entry.bestScore),
      bestClearTimeMs: fasterTime,
      boardsCleared: Math.max(prev.boardsCleared, entry.boardsCleared),
      bestWinStreak: Math.max(prev.bestWinStreak, entry.bestWinStreak),
      updatedAt: entry.updatedAt >= prev.updatedAt ? entry.updatedAt : prev.updatedAt,
    });
  });

  // Retain up to 5,000 ranked individuals so both Top 100 and individual ranks > 100 are preserved
  return sortWordMatrixLeaderboard(Array.from(map.values())).slice(0, 5000);
}

export async function syncWordMatrixLeaderboardFromSupabase(): Promise<
  WordMatrixLeaderboardEntry[]
> {
  const localEntries = getWordMatrixLeaderboard();
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', WORD_MATRIX_LEADERBOARD_KEY)
      .maybeSingle();

    if (!error && data && data.setting_value) {
      const rawStr =
        typeof data.setting_value === 'string'
          ? data.setting_value
          : JSON.stringify(data.setting_value);
      const remoteEntries = parseWordMatrixLeaderboard(rawStr);
      const merged = mergeTwoLeaderboardLists(remoteEntries, localEntries);
      if (typeof window !== 'undefined') {
        localStorage.setItem(WORD_MATRIX_LEADERBOARD_KEY, JSON.stringify(merged));
        window.dispatchEvent(new Event('bs_word_matrix_sync'));
      }
      return merged;
    }
  } catch {
    // Fallback to localStorage
  }
  return localEntries;
}

export async function upsertWordMatrixLeaderboardEntry(
  incoming: Omit<WordMatrixLeaderboardEntry, 'updatedAt'>
): Promise<{ entries: WordMatrixLeaderboardEntry[]; rank: number }> {
  const latestPool = await syncWordMatrixLeaderboardFromSupabase();
  const stamped: WordMatrixLeaderboardEntry = {
    ...incoming,
    name: incoming.name.trim() || 'Banking Aspirant',
    targetExam: incoming.targetExam.trim() || 'Banking Exams 2026',
    updatedAt: new Date().toISOString(),
  };

  const merged = mergeTwoLeaderboardLists(latestPool, [stamped]);
  const serialized = JSON.stringify(merged);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(WORD_MATRIX_LEADERBOARD_KEY, serialized);
      window.dispatchEvent(new Event('bs_word_matrix_sync'));
    } catch {
      // Ignore quota errors
    }
  }

  await persistSettingToSupabase(WORD_MATRIX_LEADERBOARD_KEY, serialized);
  const idx = merged.findIndex((e) => e.userId === incoming.userId);
  return {
    entries: merged,
    rank: idx >= 0 ? idx + 1 : merged.length,
  };
}

export function getUserWordMatrixRank(
  userId: string | null | undefined,
  entriesInput?: WordMatrixLeaderboardEntry[]
): {
  rank: number | null;
  entry: WordMatrixLeaderboardEntry | null;
  totalPlayers: number;
  pointsToTop100: number;
} {
  const list = entriesInput ?? getWordMatrixLeaderboard();
  if (!userId) {
    return { rank: null, entry: null, totalPlayers: list.length, pointsToTop100: 0 };
  }
  const idx = list.findIndex((e) => e.userId === userId);
  if (idx === -1) {
    const cutoffScore = list.length >= 100 ? list[99].bestScore : 0;
    return {
      rank: null,
      entry: null,
      totalPlayers: list.length,
      pointsToTop100: cutoffScore > 0 ? cutoffScore + 1 : 0,
    };
  }
  const rank = idx + 1;
  const entry = list[idx];
  const pointsToTop100 =
    rank > 100 && list.length >= 100
      ? Math.max(1, list[99].bestScore - entry.bestScore + 1)
      : 0;

  return {
    rank,
    entry,
    totalPlayers: list.length,
    pointsToTop100,
  };
}
