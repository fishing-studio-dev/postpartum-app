// R10-8：出生届は大村市に出す（2026-11-11 ご本人の指示）。
// 太宰府で出す前提だった文を、大村市で出す形に直す。新しい事実（電話番号・時間・住所）は作らない（番号は前から入っていたものだけ）。
// 直すのは下の項目の、下の欄だけ。いまの値が「前の文（from）」とまったく同じときだけ「新しい文（to）」にする（自分で書き直した文には触れない）。
// 日付・済み・メモ・担当・予定は不要の印には触れない。
export const OMURA_FIXES = Object.freeze([
  {id: 'shussei-todoke', field: 'place',
    from: '太宰府市（出生地）／大村市（所在地）どちらでも可',
    to: '大村市（所在地）'},
  {id: 'shussei-todoke', field: 'note',
    from: '太宰府市役所1階 市民課（平日8:30-17:00、092-921-2121）。祖父母が持参しても届出人欄は父か母の署名が必要。大村市の住民票に反映されるまで数日〜1週間程度かかる見込み（要確認）。',
    to: '大村市役所に出す。受付の窓口と時間は市役所に確認（代表 0957-53-4111）。祖父母が持参しても届出人欄は父か母の署名が必要。'},
  {id: 'shussei-todoke', field: 'sourceUrl',
    from: 'https://www.city.dazaifu.lg.jp/site/navi/2674.html',
    to: ''},
  {id: 'jidou-teate', field: 'note',
    from: '里帰り先では申請できない。申請月の翌月分から支給、遅れた月分はもらえない。0〜3歳未満は月1万5千円、偶数月に2か月分。公務員は勤務先で申請。郵送・オンライン可否と、出生届が太宰府経由で未反映の時の扱いは要電話確認（こどもセンター（0957-54-9100））。',
    to: '里帰り先では申請できない。申請月の翌月分から支給、遅れた月分はもらえない。0〜3歳未満は月1万5千円、偶数月に2か月分。公務員は勤務先で申請。郵送・オンライン可否は要電話確認（こどもセンター（0957-54-9100））。'},
  {id: 'mynumber', field: 'note',
    from: '簡易書留は大村の自宅に届く→受け取れる人がいるか確認。太宰府で出生届を出す場合に大村のカード同時申請ができるかは要確認（市民課 0957-53-4111 内線182）。マイナ保険証にするにはカード取得後に健康保険証利用登録。それまでは資格確認書で受診。',
    to: '簡易書留は大村の自宅に届く→受け取れる人がいるか確認。大村市で出生届を出すときにカードを同時申請できるか・その手順は要確認（市民課 0957-53-4111 内線182）。マイナ保険証にするにはカード取得後に健康保険証利用登録。それまでは資格確認書で受診。'},
  {id: 'kakunin-mynumber', field: 'title',
    from: '太宰府で出生届を出すとき、マイナンバーカードを同時申請できるか',
    to: '大村市で出生届を出すとき、マイナンバーカードを同時申請できるか'},
  {id: 'kakunin-jidou', field: 'title',
    from: '児童手当：郵送・電子申請できるか／出生届が未反映の時の扱い',
    to: '児童手当：郵送・電子申請できるか'}
].map(Object.freeze));
export const OMURA_IDS = Object.freeze([...new Set(OMURA_FIXES.map(f => f.id))]);

// 保存されている項目 data に対して、直す欄だけの patch（{field: to}）。直すものが無ければ {}。
export function omuraPatch(id, data) {
  const patch = {};
  if (!data) return patch;
  for (const f of OMURA_FIXES) if (f.id === id && data[f.field] === f.from) patch[f.field] = f.to;
  return patch;
}
// 画面に出すとき（まだ直していない古い文が届いたとき）も、大村の文で見せる。保存されている値は変えない。
export function omuraView(item) {
  if (!item || !OMURA_IDS.includes(item.id)) return item;
  const patch = omuraPatch(item.id, item);
  return Object.keys(patch).length ? {...item, ...patch} : item;
}
