// R8 で増えた項目（seedVersion 2）。手で書いたもの。医療の内容は入れない。
// すでにある項目には触れず、Firestore に無いものだけを作る（data.js の ensureSeeded）。
export const SEED_V2_ITEMS = [
  {
    id: 'r8-tantou',
    title: 'やることの「いつ・誰が」を決める',
    category: '準備',
    calc: null,
    place: '',
    documents: [],
    note: '項目を開くと「いつ」「誰が」を入れられます。ふたりの画面にすぐ出ます。',
    sourceUrl: '',
    confidence: '',
    rule: '',
    tag: ''
  },
  {
    id: 'r8-calendar',
    title: '大事な予定をカレンダーに入れる',
    category: '準備',
    calc: null,
    place: '',
    documents: [],
    note: '項目を開いて「カレンダーに追加」。アプリを閉じていても、カレンダーの通知が届きます。',
    sourceUrl: '',
    confidence: '',
    rule: '',
    tag: ''
  }
];
