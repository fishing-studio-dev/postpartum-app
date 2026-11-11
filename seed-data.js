// research/items.json から tools/build-seed.mjs で作成（手で直さない）。
// 公式リンク（sourceUrl）は表示するだけで、アプリからは読み込まない。
export const SEED_ITEMS = [
 {
  "id": "shussei-todoke",
  "title": "出生届を出す",
  "category": "手続き",
  "calc": {
   "base": "birth",
   "days": 13,
   "rollToOpenDay": true
  },
  "rule": "出生日を1日目として14日以内（14日目が閉庁日なら翌開庁日）",
  "place": "大村市（所在地）",
  "documents": [
   "出生届（右側の出生証明書を病院で記入済み）",
   "母子健康手帳",
   "届出人（父か母）の署名",
   "（窓口に行く人の本人確認書類）"
  ],
  "note": "大村市役所に出す。受付の窓口と時間は市役所に確認（代表 0957-53-4111）。祖父母が持参しても届出人欄は父か母の署名が必要。",
  "sourceUrl": "",
  "confidence": "high"
 },
 {
  "id": "jidou-teate",
  "title": "児童手当を申請",
  "category": "お金",
  "calc": {
   "base": "birth",
   "days": 15
  },
  "rule": "出生日の翌日から数えて15日以内に住所地（大村市）へ認定請求",
  "place": "大村市（こどもセンター こども政策課）",
  "documents": [
   "認定請求書（窓口）",
   "請求者（原則収入の多い親）名義の口座がわかるもの",
   "マイナンバーがわかるもの（配偶者または子が市外住所の場合）",
   "本人確認書類"
  ],
  "note": "里帰り先では申請できない。申請月の翌月分から支給、遅れた月分はもらえない。0〜3歳未満は月1万5千円、偶数月に2か月分。公務員は勤務先で申請。郵送・オンライン可否は要電話確認（こどもセンター（0957-54-9100））。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomosomu/kenko/kosodate/teate/jidouteate.html",
  "confidence": "high"
 },
 {
  "id": "kenpo-fuyou",
  "title": "赤ちゃんの健康保険に加入",
  "category": "手続き",
  "calc": {
   "base": "birth",
   "days": 13,
   "rollToOpenDay": true
  },
  "rule": "会社の健保：勤務先経由で被扶養者（異動）届（事業主は事実発生から5日以内に提出）／国保：14日以内に市民課",
  "place": "勤務先（会社員）／大村市 市民課（国保）",
  "documents": [
   "勤務先指定の届（被扶養者（異動）届）",
   "赤ちゃんの氏名・生年月日・マイナンバー（わかり次第）",
   "国保の場合：本人確認書類、マイナンバーがわかるもの"
  ],
  "note": "福祉医療の申請に赤ちゃんの資格確認書（またはマイナ保険証）が必要なので早めに。受診予定があれば資格証明書を勤務先に依頼。夫婦どちらの扶養に入れるか（収入の多い方が原則）を決めておく。",
  "sourceUrl": "https://www.nenkin.go.jp/section/faq/kounen/dependents/add/shinseiji.html",
  "confidence": "high"
 },
 {
  "id": "kokuho-omura",
  "title": "（国保の場合）国保に加入",
  "category": "手続き",
  "calc": {
   "base": "birth",
   "days": 13,
   "rollToOpenDay": true
  },
  "rule": "出生から14日以内",
  "place": "大村市 市民課",
  "documents": [
   "顔写真付き本人確認書類",
   "マイナンバーがわかるもの"
  ],
  "note": "夫婦が会社の健保なら不要。市民課 0957-53-4111（内線102）。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kokuho/kenko/nenkin/kenkohoken/kanyu.html",
  "confidence": "high"
 },
 {
  "id": "fukushi-iryo",
  "title": "子ども福祉医療の受給資格者証",
  "category": "お金",
  "calc": null,
  "rule": "期限の定めなし（出生日から対象）。保険の資格確認書が届いたらすぐ申請",
  "place": "大村市（福祉総務課 本庁1階／こどもセンター）。里帰り中は郵送可",
  "documents": [
   "受給資格認定申請書",
   "赤ちゃんの資格確認書（コピー）またはマイナ保険証",
   "普通預金通帳（郵送時は1ページ目のコピー）"
  ],
  "note": "窓口払いが1医療機関1か月800円/1,600円に。未就学児が窓口で使えるのは長崎県内のみ→太宰府（福岡）で受診した分は領収書原本で後から申請（5年以内）。郵送先：〒856-8686 大村市福祉総務課福祉医療グループ、届くまで数週間。問合せ 0957-53-4111（内線156）。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/fukushiiryo/kenko/fukushi/fukushiiryo/nyuyoji.html",
  "confidence": "high"
 },
 {
  "id": "ichijikin-chokusetsu",
  "title": "出産育児一時金（直接支払）の合意",
  "category": "お金",
  "calc": null,
  "rule": "出産した病院を退院するまでに直接支払制度の合意文書に同意",
  "place": "病院（太宰府の出産施設）",
  "documents": [
   "健康保険の資格確認書またはマイナ保険証（母／扶養者）",
   "直接支払制度の合意文書（病院が用意）"
  ],
  "note": "1児50万円（産科医療補償制度加入施設）。費用が超えた分は退院時に病院へ支払う。合意文書と領収・明細書は差額申請に使うので保管。",
  "sourceUrl": "https://www.kyoukaikenpo.or.jp/benefit/childbirth/002/index.html",
  "confidence": "high"
 },
 {
  "id": "ichijikin-sagaku",
  "title": "出産育児一時金の差額を請求",
  "category": "お金",
  "calc": null,
  "rule": "出産費用が50万円未満の場合。協会けんぽは出産後おおむね3か月で差額申請書を送付（早く欲しい場合は内払金支払依頼書）",
  "place": "加入している健保（協会けんぽ支部など）／国保なら大村市 国保・後期保険課",
  "documents": [
   "差額申請書（届いたもの）または内払金支払依頼書",
   "領収・明細書のコピー",
   "直接支払制度合意文書のコピー"
  ],
  "note": "健保組合・共済は手順が異なるので加入先で確認。国保は市へ申請（0957-53-4111 内線110・111・119）。",
  "sourceUrl": "https://www.kyoukaikenpo.or.jp/benefit/childbirth/002/index.html",
  "confidence": "medium"
 },
 {
  "id": "ninpu-kyufu-2",
  "title": "妊婦支援給付金（2回目）の届出",
  "category": "お金",
  "calc": {
   "base": "due",
   "years": 2,
   "days": -57
  },
  "rule": "出産予定日の8週間前の日から2年以内。妊娠32週ごろ案内送付",
  "place": "大村市（電子申請）",
  "documents": [
   "振込先口座（妊産婦本人名義）またはゆでぴアカウント番号",
   "大村市電子申請「【妊婦支援給付金】胎児の数の届出」"
  ],
  "note": "胎児1人5万円（ゆでぴなら52,500円分）。申請者は妊産婦本人のみ。すでに届出済みかを確認。申請から2か月以内に振込。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomoshomu/kenko/kosodate/jigyo/bansogata_shien_oenkin.html",
  "confidence": "high"
 },
 {
  "id": "shussei-renraku",
  "title": "出生連絡票を出す（低体重なら届出）",
  "category": "手続き",
  "calc": null,
  "rule": "出産後すみやかに（電話でも可）。2,500g未満は母子保健法の低体重児届も速やかに",
  "place": "大村市（こどもセンター／国保けんこう課）。電話可",
  "documents": [
   "母子健康手帳 別冊の「出生連絡票」"
  ],
  "note": "これで赤ちゃん訪問の手配が始まる。里帰り先で訪問を受けたい場合もこのとき伝える。こどもセンター（0957-54-9100）",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/oyako/kenko/kosodate/okosan/akachanhomon.html",
  "confidence": "high"
 },
 {
  "id": "akachan-houmon",
  "title": "赤ちゃん訪問（こんにちは赤ちゃん）",
  "category": "健診",
  "calc": {
   "base": "birth",
   "months": 4
  },
  "rule": "生後4か月まで。日程調整は産後2〜3か月ごろ",
  "place": "大村の自宅（希望すれば太宰府の里帰り先）",
  "documents": [
   "母子健康手帳"
  ],
  "note": "里帰り先での訪問は大村市から太宰府市へ依頼してくれる→こどもセンターへ電話（0957-54-9100）。1月中旬に戻るなら大村で受けるのが自然。訪問時に絵本のプレゼントあり。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/oyako/faq/kenko/kosodate/soudan/satogaeri.html",
  "confidence": "high"
 },
 {
  "id": "sanpu-2w",
  "title": "産後2週間健診（ママ）",
  "category": "健診",
  "calc": {
   "base": "birth",
   "days": 21
  },
  "rule": "出生後5日以降21日以内（受診票の有効期限）",
  "place": "病院（出産施設など）",
  "documents": [
   "産婦健康診査受診票（大村市）",
   "母子健康手帳",
   "資格確認書／マイナ保険証"
  ],
  "note": "1回上限5,000円助成。太宰府の病院で受診票が使えない場合は全額払って、受診票に結果を書いてもらい領収書原本を保管→1年以内に大村市へ償還申請。受診票が福岡の病院で使えるかは要確認（こどもセンター（0957-54-9100））。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/oyako/kenko/ninshin/jose/sangokennkousinnsa.html",
  "confidence": "medium"
 },
 {
  "id": "sanpu-1m",
  "title": "産後1か月健診（ママ）",
  "category": "健診",
  "calc": {
   "base": "birth",
   "days": 56
  },
  "rule": "出生後22日以降56日以内",
  "place": "病院（出産施設など）",
  "documents": [
   "産婦健康診査受診票（大村市）",
   "母子健康手帳",
   "資格確認書／マイナ保険証"
  ],
  "note": "上限5,000円助成。使えない場合は償還払い（申請書・領収書原本・母子手帳・結果記入済み受診票、受診後1年以内）。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/oyako/kenko/ninshin/jose/sangokennkousinnsa.html",
  "confidence": "medium"
 },
 {
  "id": "baby-1m",
  "title": "1か月児健診（赤ちゃん）",
  "category": "健診",
  "calc": {
   "base": "birth",
   "days": 41
  },
  "rule": "生後28日〜41日（出生日を0日目）",
  "place": "病院（出産施設など）",
  "documents": [
   "乳児一般健康診査受診票（1か月児、問診票を記入）",
   "母子健康手帳",
   "赤ちゃんの資格確認書（届いていれば）"
  ],
  "note": "上限5,400円助成（令和8年4月開始）。全額自己負担した場合は結果記入済み受診票と領収書をもらい、1年以内に償還申請。年末で病院が混むので早めに予約。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/oyako/kenko/kosodate/okosan/1month.html",
  "confidence": "high"
 },
 {
  "id": "choukaku",
  "title": "新生児聴覚検査の助成",
  "category": "健診",
  "calc": {
   "base": "birth",
   "years": 1,
   "days": 3
  },
  "rule": "生後2〜5日に出生施設で検査。県外受検は償還払い、検査日から1年以内に申請",
  "place": "病院で検査／申請は大村市こども家庭課（持参・郵送）",
  "documents": [
   "新生児聴覚検査費等支給申請書",
   "領収書または明細書",
   "母子手帳の検査記録ページのコピー",
   "振込先口座がわかるもの"
  ],
  "note": "1検査上限3,000円（確認検査含め2回まで）。福岡県の病院は県外扱い。期限日は検査が生後3日目と仮定した目安。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/oyako/kenko/kosodate/okosan/shinseijichoukaku.html",
  "confidence": "high"
 },
 {
  "id": "taisha-kensa",
  "title": "先天性代謝異常等検査",
  "category": "健診",
  "calc": {
   "base": "birth",
   "days": 7
  },
  "rule": "出産後5〜7日ごろ、出生施設で採血",
  "place": "病院",
  "documents": [
   "母子健康手帳 別冊の申込書"
  ],
  "note": "大村市は検査料無料・採血料は自己負担と案内。福岡の病院で大村の申込書が使えるか、費用の扱いは要確認（こどもセンター（0957-54-9100））。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/fukushi/kenko/fukushi/shisaku/documents/6kodomo2025.pdf",
  "confidence": "low"
 },
 {
  "id": "nyuji-kenshin-1",
  "title": "乳児健診（3〜6か月）",
  "category": "健診",
  "calc": {
   "base": "birth",
   "months": 6,
   "days": -1
  },
  "rule": "3〜6か月児の一般健康診査（個別健診）。市から日程通知はなく自分で小児科へ予約",
  "place": "大村市内の小児科",
  "documents": [
   "乳児一般健康診査受診票（妊娠届時に交付）",
   "母子健康手帳"
  ],
  "note": "集団健診ではない。市内小児科：ありやま0957-49-6410、おおむらこども0957-56-8651、すだ0957-54-7200、田川0957-52-4000、出口0957-52-2252、野口0957-52-2339、ふじもと0957-47-8887。9〜11か月健診は期間外。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/oyako/kenko/kosodate/okosan/nyuj.html",
  "confidence": "high"
 },
 {
  "id": "sango-care",
  "title": "産後ケア（宿泊・通所・訪問）",
  "category": "準備",
  "calc": null,
  "rule": "産後1年未満。初回利用前に申請（利用券が届くまで約1週間）",
  "place": "大村市に申請→長崎県内の施設・助産師",
  "documents": [
   "申請（電子申請・電話・来所）",
   "大村市産後ケア利用券",
   "母子健康手帳"
  ],
  "note": "合計7日まで、5日目まで低額（通所・訪問は無料）。対象施設は長崎県内のみと読める→太宰府滞在中は使えない可能性が高い（要電話確認 こどもセンター（0957-54-9100））。太宰府市の産後ケアは太宰府市民向け。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/oyako/kenko/ninshin/jose/sangocare.html",
  "confidence": "medium"
 },
 {
  "id": "mynumber",
  "title": "赤ちゃんのマイナンバー",
  "category": "手続き",
  "calc": null,
  "rule": "出生届後 約1か月で世帯主宛てに個人番号通知書（簡易書留）。カードは出生届と同時申請なら1〜2週間",
  "place": "大村市（市民課 個人番号カードグループ）",
  "documents": [
   "個人番号通知書",
   "カード申請書（同時申請の場合）",
   "4桁の暗証番号を決めておく"
  ],
  "note": "簡易書留は大村の自宅に届く→受け取れる人がいるか確認。大村市で出生届を出すときにカードを同時申請できるか・その手順は要確認（市民課 0957-53-4111 内線182）。マイナ保険証にするにはカード取得後に健康保険証利用登録。それまでは資格確認書で受診。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/mynumber/faq/kurashi/koseki/tsuuchicard/kojinbangoutuutisho.html",
  "confidence": "medium"
 },
 {
  "id": "vac-irai",
  "title": "太宰府で予防接種する場合の事前申請",
  "category": "予防接種",
  "calc": {
   "base": "birth",
   "months": 2,
   "days": -7
  },
  "rule": "接種前に「予防接種実施依頼書交付申請書」を提出→依頼書と予診票が郵送される（依頼書の有効期間3か月）。接種後2年以内に償還申請",
  "place": "大村市こども家庭課に申請→太宰府の医療機関で接種",
  "documents": [
   "予防接種実施依頼書交付申請書（様式第1号）",
   "接種後：償還払申請書兼請求書（様式第3号）",
   "領収書原本",
   "母子手帳など接種記録",
   "予診票の原本かコピー"
  ],
  "note": "大村へ戻るのが生後2か月より前なら、2か月からの初回接種は大村の指定医療機関で受けられる＝この申請は不要。戻りが遅れる場合だけ必要。払戻しは大村市の料金が上限。大村市は予診票を事前郵送しない（市内は医療機関に置いてある）。こどもセンター（0957-54-9100）",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomoshomu/kenko/kenko/yobosesshu/syoukannbarai.html",
  "confidence": "high",
  "tag": "太宰府で受ける場合",
  "ifReturnAfter": {
   "base": "birth",
   "months": 2
  }
 },
 {
  "id": "vac-2m",
  "title": "2か月の予防接種（同時接種）",
  "category": "予防接種",
  "calc": {
   "base": "birth",
   "months": 2,
   "kind": "from"
  },
  "rule": "生後2か月から：五種混合1回目、小児用肺炎球菌1回目、B型肝炎1回目、ロタ1回目",
  "place": "大村市の指定医療機関（小児科）",
  "documents": [
   "母子健康手帳",
   "（予診票は医療機関にある）",
   "赤ちゃんの資格確認書・受給資格者証（体調相談用）"
  ],
  "note": "市内指定小児科：ありやま、おおむらこども、すだ、田川、出口、野口、ふじもと、もとやま。無料。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomoshomu/kenko/kosodate/nyuyoujishouni/nyuyojiyobou.html",
  "confidence": "high",
  "tag": "大村で受ける場合"
 },
 {
  "id": "vac-rota",
  "title": "ロタウイルス",
  "category": "予防接種",
  "calc": {
   "base": "birth",
   "days": 104
  },
  "rule": "初回は生後2か月〜出生14週6日後まで。1価：27日以上あけ2回（出生24週まで）／5価：27日以上あけ3回（出生32週まで）",
  "place": "大村市の指定医療機関",
  "documents": [
   "母子健康手帳"
  ],
  "note": "初回期限を過ぎると受けられない。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomoshomu/kenko/kenko/yobosesshu/rota.html",
  "confidence": "high",
  "tag": "大村で受ける場合"
 },
 {
  "id": "vac-5shu",
  "title": "五種混合（初回3回）",
  "category": "予防接種",
  "calc": {
   "base": "birth",
   "months": 7
  },
  "rule": "初回は生後2〜7か月に20〜56日間隔で3回。追加は初回終了後6か月以上（標準6〜18か月）あけ1回。対象は生後90か月まで",
  "place": "大村市の指定医療機関",
  "documents": [
   "母子健康手帳"
  ],
  "note": "ポリオ・百日せき・ジフテリア・破傷風・ヒブ。追加接種は期間外。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomoshomu/kenko/kenko/yobosesshu/gosyukonngou.html",
  "confidence": "high",
  "tag": "大村で受ける場合"
 },
 {
  "id": "vac-haien",
  "title": "小児用肺炎球菌（初回）",
  "category": "予防接種",
  "calc": {
   "base": "birth",
   "months": 7
  },
  "rule": "対象：生後2か月〜5歳の誕生日前日。初回は生後2〜7か月に開始",
  "place": "大村市の指定医療機関",
  "documents": [
   "母子健康手帳"
  ],
  "note": "回数は開始月齢で1〜4回。通常は初回3回＋1歳以降追加1回。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomoshomu/kenko/kosodate/nyuyoujishouni/nyuyojiyobou.html",
  "confidence": "high",
  "tag": "大村で受ける場合"
 },
 {
  "id": "vac-hepb",
  "title": "B型肝炎（3回）",
  "category": "予防接種",
  "calc": {
   "base": "birth",
   "years": 1,
   "days": -1
  },
  "rule": "1歳の誕生日前日まで。標準は生後2〜9か月で3回",
  "place": "大村市の指定医療機関",
  "documents": [
   "母子健康手帳"
  ],
  "note": "一般的に2回目は1回目の27日以上後、3回目は1回目の139日以上後（間隔は医療機関で確認）。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomoshomu/kenko/kosodate/nyuyoujishouni/nyuyojiyobou.html",
  "confidence": "medium",
  "tag": "大村で受ける場合"
 },
 {
  "id": "vac-bcg",
  "title": "BCG",
  "category": "予防接種",
  "calc": {
   "base": "birth",
   "years": 1,
   "days": -1
  },
  "rule": "1歳の誕生日前日まで。標準は生後5〜8か月に1回",
  "place": "大村市の指定医療機関（BCG対応の小児科）",
  "documents": [
   "母子健康手帳"
  ],
  "note": "6か月時点の範囲内では生後5か月から受けられる。",
  "sourceUrl": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/kekkaku-kansenshou/yobou-sesshu/vaccine/bcg/index.html",
  "confidence": "high",
  "tag": "大村で受ける場合"
 },
 {
  "id": "satogaeri-return",
  "title": "大村に戻ったら確認すること",
  "category": "準備",
  "calc": null,
  "rule": "1月中旬の帰宅時",
  "place": "大村市",
  "documents": [
   "太宰府で払った医療費の領収書（福祉医療の申請用）",
   "産婦健診・1か月健診・聴覚検査の領収書と結果記入済み受診票",
   "届いた郵便（通知書・資格者証・利用券）"
  ],
  "note": "住民票は大村のままなので転入出の届は不要。償還払いの申請をまとめて行う。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/fukushiiryo/kenko/fukushi/fukushiiryo/nyuyoji.html",
  "confidence": "medium"
 },
 {
  "id": "shussan-teate",
  "title": "出産手当金（会社員で産休中の場合）",
  "category": "お金",
  "calc": {
   "base": "birth",
   "days": 56,
   "kind": "from"
  },
  "rule": "出産日以前42日〜出産翌日以後56日の休業で給与がない日。産後分は産後56日経過後に申請",
  "place": "勤務先・加入健保",
  "documents": [
   "健康保険出産手当金支給申請書（医師・事業主の証明欄あり）"
  ],
  "note": "該当する場合のみ。出産が予定日より遅れた日数も対象。健保組合は手順を確認。",
  "sourceUrl": "https://www.kyoukaikenpo.or.jp/benefit/childbirth/001/index.html",
  "confidence": "high"
 },
 {
  "id": "ikukyu-kyufu",
  "title": "育休の給付（該当する場合）",
  "category": "お金",
  "calc": {
   "base": "birth",
   "days": 56
  },
  "rule": "雇用保険の育児休業給付・出生時育児休業給付（産後パパ育休は出生後8週以内に最大28日）・出生後休業支援給付",
  "place": "勤務先（ハローワークへの申請は通常会社経由）",
  "documents": [
   "勤務先の育休申出書",
   "母子手帳など出生を確認できる書類（会社の指示に従う）"
  ],
  "note": "取得予定と申請は勤務先に早めに相談。",
  "sourceUrl": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000135090_00001.html",
  "confidence": "medium"
 },
 {
  "id": "iryohi-koujo",
  "title": "医療費控除（2026年分）",
  "category": "お金",
  "calc": null,
  "rule": "2026年中の医療費（出産費用を含む）から出産育児一時金を差し引き、10万円等を超えた分。確定申告（還付申告は翌年1月から5年以内）",
  "place": "税務署（e-Tax）",
  "documents": [
   "医療費の領収書（健診・出産・通院交通費の記録）",
   "一時金の金額がわかる書類"
  ],
  "note": "出産手当金は差し引かない。家族の医療費は合算可。該当しなければ不要。",
  "sourceUrl": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1124.htm",
  "confidence": "medium"
 },
 {
  "id": "nencho",
  "title": "年末調整に子を追加（会社員）",
  "category": "お金",
  "calc": {
   "base": "fixed",
   "date": "2026-12-31"
  },
  "rule": "2026年の扶養控除等申告書に16歳未満の扶養親族として記載（所得税の扶養控除はないが住民税の判定に使う）",
  "place": "勤務先",
  "documents": [
   "子の氏名・生年月日・マイナンバー（わかり次第）"
  ],
  "note": "提出済みでも12月中なら会社に追加を相談。勤務先で締切が異なる。",
  "sourceUrl": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm",
  "confidence": "medium"
 },
 {
  "id": "boshi-techo",
  "title": "母子健康手帳に書いてもらう・持ち歩く",
  "category": "準備",
  "calc": null,
  "rule": "出生届・健診・予防接種のたびに持参",
  "place": "どこでも",
  "documents": [
   "母子健康手帳（出生届出済証明欄は役所で記入）",
   "別冊：出生連絡票・産婦健診受診票・乳児健診受診票・代謝異常検査申込書"
  ],
  "note": "記録は償還払いのコピー提出にも使う。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/fukushi/kenko/fukushi/shisaku/documents/6kodomo2025.pdf",
  "confidence": "high"
 },
 {
  "id": "motimono",
  "title": "手続き用の持ち物セット",
  "category": "準備",
  "calc": {
   "base": "due",
   "days": -1
  },
  "rule": "出産前〜出生直後に用意",
  "place": "－",
  "documents": [
   "父母の本人確認書類（運転免許証・マイナンバーカード）",
   "父母のマイナンバーがわかるもの",
   "児童手当の請求者名義の通帳／キャッシュカード",
   "妊産婦本人名義の口座（妊婦支援給付金）",
   "母の資格確認書またはマイナ保険証",
   "母子健康手帳と別冊",
   "印鑑（窓口で求められた時用・必須ではない）",
   "赤ちゃんの名前（候補とふりがな）"
  ],
  "note": "出生届の名前は常用漢字・人名用漢字・ひらがな・カタカナ。ふりがなは一般に認められた読み方に限る。",
  "sourceUrl": "https://www.city.dazaifu.lg.jp/site/navi/2674.html",
  "confidence": "medium"
 },
 {
  "id": "kakunin-hoken",
  "title": "健康保険の種類と、赤ちゃんをどちらの扶養に入れるか",
  "category": "確認",
  "calc": {
   "base": "birth",
   "days": 3
  },
  "rule": "協会けんぽ／健保組合／共済／国保のどれか",
  "place": "勤務先に確認",
  "documents": [],
  "note": "収入の多い方の扶養が原則。公務員なら児童手当は勤務先で申請。",
  "sourceUrl": "https://www.nenkin.go.jp/section/faq/kounen/dependents/add/shinseiji.html",
  "confidence": ""
 },
 {
  "id": "kakunin-ninpu-2",
  "title": "妊婦支援給付金2回目「胎児の数の届出」を出したか",
  "category": "確認",
  "calc": {
   "base": "birth",
   "days": 7
  },
  "rule": "",
  "place": "大村市に確認（市役所代表 0957-53-4111）",
  "documents": [],
  "note": "未提出なら電子申請で届出。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomoshomu/kenko/kosodate/jigyo/bansogata_shien_oenkin.html",
  "confidence": ""
 },
 {
  "id": "kakunin-return",
  "title": "大村へ戻る日を決める",
  "category": "確認",
  "calc": {
   "base": "birth",
   "days": 7
  },
  "rule": "",
  "place": "",
  "documents": [],
  "note": "戻る日は未定のため、予防接種は「大村で受ける場合」と「太宰府で受ける場合（依頼書）」の両方を表示しています。戻りが生後2か月より後なら、依頼書の申請が必要。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomoshomu/kenko/kenko/yobosesshu/syoukannbarai.html",
  "confidence": ""
 },
 {
  "id": "kakunin-jidou",
  "title": "児童手当：郵送・電子申請できるか",
  "category": "確認",
  "calc": {
   "base": "birth",
   "days": 3
  },
  "rule": "",
  "place": "大村市（こどもセンター 0957-54-9100）",
  "documents": [],
  "note": "",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/kodomosomu/kenko/kosodate/teate/jidouteate.html",
  "confidence": ""
 },
 {
  "id": "kakunin-jushinhyo",
  "title": "大村の受診票が福岡の病院で使えるか（産婦健診・1か月児健診・代謝異常検査）",
  "category": "確認",
  "calc": {
   "base": "birth",
   "days": 0
  },
  "rule": "",
  "place": "大村市（こどもセンター 0957-54-9100）",
  "documents": [],
  "note": "使えない場合は償還払い（領収書原本を保管）。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/oyako/kenko/ninshin/jose/sangokennkousinnsa.html",
  "confidence": ""
 },
 {
  "id": "kakunin-sangocare",
  "title": "産後ケアが太宰府滞在中に使えるか",
  "category": "確認",
  "calc": {
   "base": "birth",
   "days": 7
  },
  "rule": "",
  "place": "大村市（こどもセンター 0957-54-9100）",
  "documents": [],
  "note": "大村市の案内では長崎県内の施設のみ。",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/oyako/kenko/ninshin/jose/sangocare.html",
  "confidence": ""
 },
 {
  "id": "kakunin-mynumber",
  "title": "大村市で出生届を出すとき、マイナンバーカードを同時申請できるか",
  "category": "確認",
  "calc": {
   "base": "birth",
   "days": 0
  },
  "rule": "",
  "place": "大村市 市民課（0957-53-4111 内線182）",
  "documents": [],
  "note": "",
  "sourceUrl": "https://www.city.omura.nagasaki.jp/mynumber/faq/kurashi/koseki/tsuuchicard/kojinbangoutuutisho.html",
  "confidence": ""
 },
 {
  "id": "kakunin-yubin",
  "title": "大村の自宅に届く郵便は夫が受け取る",
  "category": "確認",
  "calc": null,
  "rule": "",
  "place": "大村の自宅",
  "documents": [
   "個人番号通知書（簡易書留）",
   "子ども福祉医療の受給資格者証",
   "予防接種の依頼書（申請した場合）"
  ],
  "note": "",
  "sourceUrl": "",
  "confidence": ""
 }
];
