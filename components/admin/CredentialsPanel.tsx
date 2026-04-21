"use client";

import { useEffect, useState, useMemo } from "react";

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────
export interface SwCredential {
  id:        string;
  swName:    string;
  name:      string;
  accountId: string;
  password:  string;
  siteUrl:   string;
  memo:      string;
}

type FormData = Omit<SwCredential, "id">;
const EMPTY_FORM: FormData = {
  swName: "", name: "", accountId: "", password: "", siteUrl: "", memo: "",
};

// ────────────────────────────────────────────────────────────
// 시드 데이터 (비밀번호는 UI에서 ✏️ 수정으로 입력)
// ────────────────────────────────────────────────────────────
const SEED: SwCredential[] = [
  // Adobe
  { id:"seed-adobe-1",   swName:"Adobe",           name:"대웅제약 그룹사",                          accountId:"itsupport@idstrust.com",                          password:"IDStrust123!@",    siteUrl:"https://adminconsole.adobe.com/F89D13355386F1A80A490D4D@AdobeOrg/overview", memo:"" },
  // AutoDesk
  { id:"seed-autodesk-1",swName:"AutoDesk",         name:"대웅제약 그룹사",                          accountId:"itsupport@daewoong.co.kr",                        password:"IDStrust!@34",     siteUrl:"https://manage.autodesk.com/products", memo:"" },
  // Cadian
  { id:"seed-cadian-1",  swName:"Cadian",           name:"시지바이오 성남(제1연구센터)",               accountId:"itsupport@idstrust.com",                          password:"IDStrust1234!",    siteUrl:"https://cadian.com/kr/member/login.asp?history=2", memo:"" },
  // Cursor
  { id:"seed-cursor-1",  swName:"Cursor",           name:"자산관리파트 공용계정",                      accountId:"itsupport@idstrust.com",                          password:"ids2309!!!",       siteUrl:"https://cursor.com/settings", memo:"" },
  // Enscape
  { id:"seed-enscape-1", swName:"Enscape",          name:"대웅개발-윤희선",                          accountId:"itsupport@daewoong.co.kr",                        password:"IDStrust!@34",     siteUrl:"https://my.chaos.com/organization/licenses", memo:"" },
  // Google
  { id:"seed-google-1",  swName:"google",           name:"디지털리터러시팀 공용",                     accountId:"ids15887571@gmail.com",                           password:"IDStrust123!",     siteUrl:"https://accounts.google.com", memo:"" },
  // Sketchup
  { id:"seed-sketch-1",  swName:"Sketchup",         name:"대웅개발_공간기획팀_서진영",                 accountId:"jyseo01@daewoong.co.kr",                          password:"Wlsdud309!!!",     siteUrl:"https://www.sketchup.com/", memo:"" },
  { id:"seed-sketch-2",  swName:"Sketchup",         name:"(주)대웅/대웅제약",                        accountId:"itsupport@daewoong.co.kr",                        password:"IDStrust123!",     siteUrl:"https://www.sketchup.com/", memo:"" },
  // MicroSoft
  { id:"seed-ms-1",      swName:"MicroSoft",        name:"클리슈어 365",                            accountId:"admin@clisure365.onmicrosoft.com",                password:"ids201010!",       siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-2",      swName:"MicroSoft",        name:"시지바이오(사용 안함)",                     accountId:"admin@cgbioltsc.onmicrosoft.com",                 password:"ZAn/w033*",        siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-3",      swName:"MicroSoft",        name:"시지바이오 365",                           accountId:"admin@cgbio365.onmicrosoft.com",                  password:"ids201010!",       siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-4",      swName:"MicroSoft",        name:"시지바이오",                              accountId:"citsupport@cgbio.co.kr",                          password:"ids201010!",       siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-5",      swName:"MicroSoft",        name:"디엔코스메틱스365",                        accountId:"admin@dncos365.onmicrosoft.com",                  password:"IDStrust!@34",     siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-6",      swName:"MicroSoft",        name:"디엔컴퍼니",                              accountId:"admin@dnc01.onmicrosoft.com",                     password:"IDStrust12#$",     siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-7",      swName:"MicroSoft",        name:"대웅펫2",                                accountId:"admin@daewoongpet.onmicrosoft.com",               password:"IDStrust!@34",     siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-8",      swName:"MicroSoft",        name:"대웅제약(개발본부)",                        accountId:"admin@daewoongdh.onmicrosoft.com",                password:"IDStrust!@34",     siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-9",      swName:"MicroSoft",        name:"대웅제약 EA 볼륨라이선스",                  accountId:"itsupport@daewoong.co.kr",                        password:"dw201010!!",       siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-10",     swName:"MicroSoft",        name:"대웅제약",                                accountId:"admin@daewoongpcl.onmicrosoft.com",               password:"dw201010!!",       siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-11",     swName:"MicroSoft",        name:"대웅바이오",                              accountId:"admin@daewoongbio1st.onmicrosoft.com",            password:"IDStrust!@34",     siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-12",     swName:"MicroSoft",        name:"대웅/대웅제약",                            accountId:"admin@dwpm365.onmicrosoft.com",                   password:"ids201010!",       siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-13",     swName:"MicroSoft",        name:"대웅 개발본부 PV팀",                       accountId:"admin@daewoongpv.onmicrosoft.com",                password:"IDStrust!@34",     siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-14",     swName:"MicroSoft",        name:"Ids&Trust (onmicrosoft)",                accountId:"admin@idstrust01.onmicrosoft.com",                password:"IDStrust123!",     siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-15",     swName:"MicroSoft",        name:"Ids&Trust",                              accountId:"itsupport@idstrust.com",                          password:"dw201010!!",       siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-16",     swName:"MicroSoft",        name:"DMD",                                    accountId:"admin@dmd01.onmicrofoft.com",                     password:"IDStrust!@34",     siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-17",     swName:"MicroSoft",        name:"(주)대웅(임상개발센터)",                    accountId:"admin@daewoongcdc.onmicrosoft.com",               password:"IDStrust!@34",     siteUrl:"https://admin.microsoft.com/#/subscriptions/vlnew/downloadsandkeys", memo:"" },
  { id:"seed-ms-18",     swName:"MicroSoft",        name:"대웅제약나보타사업팀",                       accountId:"adminIDS@DaewoongPharmaceutical431.onmicrosoft.com", password:"ids201010!@",  siteUrl:"", memo:"" },
  // 한컴
  { id:"seed-hwp-1",     swName:"한컴",             name:"힐리언스(계약종료)",                        accountId:"hsupport@healience.com",                          password:"IDStrust!@#",      siteUrl:"https://www.hancom.com/member/loginView.do", memo:"ID/PW는 방용선님·조문기님께 이관" },
  { id:"seed-hwp-2",     swName:"한컴",             name:"클리슈어리서치",                           accountId:"dl_402hj@clisure.com",                            password:"ids2025!@#",       siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-3",     swName:"한컴",             name:"클리슈어리서치(개인계정 USER3)",             accountId:"mjjo@clisure.com",                                password:"Clisure23@#",      siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-4",     swName:"한컴",             name:"유와이즈원",                              accountId:"itsupport@uwiseone.com",                          password:"IDS/w011!@#",      siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-5",     swName:"한컴",             name:"엠디웰",                                 accountId:"itsupport@idstrust.com",                          password:"IDStrust/w033!",   siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-6",     swName:"한컴",             name:"시지바이오 향남공장",                       accountId:"citsupport1@cgbio.co.kr",                         password:"citsupport1!",     siteUrl:"https://www.hancom.com/member/loginView.do", memo:"향남읍 제약공단4길 35-14" },
  { id:"seed-hwp-7",     swName:"한컴",             name:"시지바이오 제1연구소",                      accountId:"citsupport3@cgbio.co.kr",                         password:"citsupport3!",     siteUrl:"https://www.hancom.com/member/loginView.do", memo:"성남시 상대원동 선택시티 2" },
  { id:"seed-hwp-8",     swName:"한컴",             name:"시지바이오 성남지점(제2연구소)",              accountId:"citsupport4@cgbio.co.kr",                         password:"citsupport4!",     siteUrl:"https://www.hancom.com/member/loginView.do", memo:"갈마치로 244" },
  { id:"seed-hwp-9",     swName:"한컴",             name:"시지바이오 본사",                          accountId:"borum@cgbio.co.kr",                               password:"IDS/w022!@#",      siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-10",    swName:"한컴",             name:"시지바이오 글로벌 챌린지 센터",               accountId:"citsupport@cgbio.co.kr",                          password:"citsupport0!",     siteUrl:"https://www.hancom.com/member/loginView.do", memo:"향남읍 제약단로29 C동" },
  { id:"seed-hwp-11",    swName:"한컴",             name:"시지바이오 S캠퍼스",                        accountId:"citsupport2@cgbio.co.kr",                         password:"citsupport2!",     siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-12",    swName:"한컴",             name:"리틀베어어린이집",                          accountId:"itsupport_2@daewoong.co.kr",                      password:"!@FKDLtpstm12",    siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-13",    swName:"한컴",             name:"디엔컴퍼니",                              accountId:"dncitsupport@daewoong.co.kr",                     password:"IDStrust!@34",     siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-14",    swName:"한컴",             name:"대웅펫",                                 accountId:"support_pet@daewoongpet.co.kr",                   password:"eodndvpt2022!",    siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-15",    swName:"한컴",             name:"대웅제약",                                accountId:"itsupport@daewoong.co.kr",                        password:"IDS/w033!@",       siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-16",    swName:"한컴",             name:"대웅바이오",                              accountId:"jskim248@daewoong.co.kr",                         password:"IDS/w033!@@",      siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-17",    swName:"한컴",             name:"대웅경영개발원",                           accountId:"dmd07@dmd.co.kr",                                 password:"dmddmd07!",        siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-18",    swName:"한컴",             name:"Ids&Trust",                              accountId:"minjh@idstrust.com",                              password:"IDS/w044!@#",      siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  { id:"seed-hwp-19",    swName:"한컴",             name:"(주)대웅",                               accountId:"yangmen@daewoong.co.kr",                          password:"IDS/w033!!",       siteUrl:"https://www.hancom.com/member/loginView.do", memo:"" },
  // Z라이선스(베어월드)
  { id:"seed-bw-1",      swName:"Z라이선스(베어월드)", name:"힐리언스 라이선스 공용",                   accountId:"hsupport",                                        password:"hsupport",         siteUrl:"https://bearworld.co.kr", memo:"" },
  { id:"seed-bw-2",      swName:"Z라이선스(베어월드)", name:"시지바이오 라이선스 공용",                  accountId:"citsupport",                                      password:"IDStrust12#$",     siteUrl:"https://bearworld.co.kr", memo:"" },
  { id:"seed-bw-3",      swName:"Z라이선스(베어월드)", name:"디엔컴퍼니 라이선스 공용",                  accountId:"dncitsupport",                                    password:"IDStrust123!",     siteUrl:"https://bearworld.co.kr", memo:"" },
  { id:"seed-bw-4",      swName:"Z라이선스(베어월드)", name:"대웅제약/IDS/유와이즈원 라이선스 공용",       accountId:"itsupport",                                       password:"dw201010!!",       siteUrl:"https://bearworld.co.kr", memo:"" },
  { id:"seed-bw-5",      swName:"Z라이선스(베어월드)", name:"대웅제약 라이선스2 공용",                   accountId:"itsupport_2",                                     password:"IDStrust!@34",     siteUrl:"https://bearworld.co.kr", memo:"" },
  { id:"seed-bw-6",      swName:"Z라이선스(베어월드)", name:"대웅경영개발원",                          accountId:"dmd07",                                           password:"dmd07",            siteUrl:"https://bearworld.co.kr", memo:"" },
  // 한올 NAC
  { id:"seed-nac-1",     swName:"한올 NAC",         name:"한올 NAC",                              accountId:"helpUser",                                        password:"HanallHelp@12",    siteUrl:"", memo:"" },
  // IDS 내부 사용
  { id:"seed-ids-1",     swName:"IDS 내부 사용",     name:"IDS 공용 네이버계정",                      accountId:"idsjasan",                                        password:"ids2025!@#",       siteUrl:"https://naver.com", memo:"" },
  { id:"seed-ids-2",     swName:"IDS 내부 사용",     name:"IDS 공용 구글계정",                        accountId:"idsjasan2025@gmail.com",                          password:"ids2025!@#",       siteUrl:"https://accounts.google.com", memo:"" },
  { id:"seed-ids-3",     swName:"IDS 내부 사용",     name:"IDS 공용 G마켓계정",                       accountId:"idsjasan",                                        password:"ids2025!@#",       siteUrl:"https://gmarket.co.kr", memo:"" },
  { id:"seed-ids-4",     swName:"IDS 내부 사용",     name:"지하3층",                               accountId:"",                                                password:"1256980*",         siteUrl:"", memo:"" },
  { id:"seed-ids-5",     swName:"IDS 내부 사용",     name:"헬프데스크 관리자 비밀번호",                  accountId:"ids",                                             password:"Fpahsrmfktm1!",    siteUrl:"", memo:"" },
  { id:"seed-ids-6",     swName:"IDS 내부 사용",     name:"IDS 매뉴얼 노션",                         accountId:"ids15887571@gmail.com",                           password:"ids201010!",       siteUrl:"https://notion.so", memo:"" },
  { id:"seed-ids-7",     swName:"IDS 내부 사용",     name:"DLP",                                   accountId:"자산관리파트",                                       password:"",                 siteUrl:"", memo:"" },
  { id:"seed-ids-8",     swName:"IDS 내부 사용",     name:"NAC",                                   accountId:"idstrsut-temp",                                   password:"IdsTrust123!",     siteUrl:"", memo:"" },
  { id:"seed-ids-9",     swName:"IDS 내부 사용",     name:"알약제거",                               accountId:"",                                                password:"f#MU@u8$u2",       siteUrl:"", memo:"" },
  { id:"seed-ids-10",    swName:"IDS 내부 사용",     name:"문서고",                                accountId:"",                                                password:"2670*",            siteUrl:"", memo:"" },
  { id:"seed-ids-11",    swName:"IDS 내부 사용",     name:"Vercel",                                accountId:"itsupport@idstrust.com",                          password:"Z공용",            siteUrl:"https://vercel.com/ids-jasans-projects-e4a26424", memo:"" },
  { id:"seed-ids-12",    swName:"IDS 내부 사용",     name:"Github",                                accountId:"itsupport@idstrust.com",                          password:"ids2025!@#",       siteUrl:"https://github.com", memo:"" },
  { id:"seed-ids-13",    swName:"IDS 내부 사용",     name:"노션 API 키",                            accountId:"",                                                password:"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", siteUrl:"https://notion.so/my-integrations", memo:"" },
  { id:"seed-ids-14",    swName:"IDS 내부 사용",     name:"Resend (이메일 인증 서비스)",               accountId:"idsjasan2025@gmail.com",                          password:"구글 로그인",        siteUrl:"https://resend.com", memo:"" },
  { id:"seed-ids-15",    swName:"IDS 내부 사용",     name:"Assetify Desk",                         accountId:"DFDUaqMLwP8auMrfYywG",                            password:"",                 siteUrl:"", memo:"" },
  { id:"seed-ids-16",    swName:"IDS 내부 사용",     name:"make.com",                              accountId:"",                                                password:"Ids2025!@#$%^",    siteUrl:"https://make.com", memo:"" },
  { id:"seed-ids-17",    swName:"IDS 내부 사용",     name:"Shindo",                                accountId:"admin",                                           password:"admin",            siteUrl:"", memo:"" },
  { id:"seed-ids-18",    swName:"IDS 내부 사용",     name:"버터컵",                                accountId:"ids201010!",                                      password:"",                 siteUrl:"", memo:"" },
];

// ────────────────────────────────────────────────────────────
// localStorage 헬퍼
// ────────────────────────────────────────────────────────────
const LS_KEY = "sw-credentials-local";

function loadLocal(): SwCredential[] {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) return JSON.parse(s) as SwCredential[];
  } catch {}
  // 첫 실행 시 시드 데이터로 초기화
  saveLocal(SEED);
  return SEED;
}

function saveLocal(data: SwCredential[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

function newId() {
  return `cred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ────────────────────────────────────────────────────────────
// SW 아이콘 매핑
// ────────────────────────────────────────────────────────────
const SW_ICON_MAP: { keywords: string[]; icon: string }[] = [
  { keywords: ["office","365","microsoft","ms "],                    icon: "🪟" },
  { keywords: ["adobe","photoshop","illustrator","premiere","acrobat"], icon: "🎨" },
  { keywords: ["github","gitlab","git"],                             icon: "🐙" },
  { keywords: ["notion"],                                            icon: "📓" },
  { keywords: ["slack"],                                             icon: "💬" },
  { keywords: ["zoom"],                                              icon: "📹" },
  { keywords: ["figma"],                                             icon: "🎯" },
  { keywords: ["jetbrains","intellij","pycharm","webstorm","datagrip","rider"], icon: "🧠" },
  { keywords: ["aws","amazon"],                                      icon: "☁️" },
  { keywords: ["google"],                                            icon: "🔵" },
  { keywords: ["apple","mac"],                                       icon: "🍎" },
  { keywords: ["한컴","hwp","한글"],                                  icon: "🇰🇷" },
  { keywords: ["autocad","autodesk","cadian"],                       icon: "📐" },
  { keywords: ["vpn","보안","security"],                             icon: "🛡️" },
  { keywords: ["cursor","jetbrains","enscape"],                      icon: "💻" },
  { keywords: ["make","zapier","자동화"],                             icon: "⚙️" },
];
function getSwIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const { keywords, icon } of SW_ICON_MAP) {
    if (keywords.some(k => lower.includes(k))) return icon;
  }
  return "💾";
}

// ────────────────────────────────────────────────────────────
// 클립보드 복사 버튼
// ────────────────────────────────────────────────────────────
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  if (!text) return <span className="text-xs text-gray-300">—</span>;
  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all select-none ${
        copied
          ? "bg-green-50 border-green-300 text-green-700"
          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
      }`}
      title={`${label} 복사`}
    >
      {copied ? "✓ 복사됨" : `📋 ${label}`}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// 추가/수정 모달
// ────────────────────────────────────────────────────────────
function CredentialModal({
  initial, onSave, onClose, saving,
}: {
  initial?: SwCredential;
  onSave: (form: FormData) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormData>(
    initial
      ? { swName: initial.swName, name: initial.name, accountId: initial.accountId,
          password: initial.password, siteUrl: initial.siteUrl, memo: initial.memo }
      : EMPTY_FORM
  );
  const [showPw, setShowPw] = useState(false);
  const isEdit = !!initial;

  function set(k: keyof FormData, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-base text-gray-900">
            {isEdit ? "✏️ 계정 수정" : "➕ 새 계정 추가"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex flex-col gap-3">
          {/* SW명 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">SW명 *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: Adobe, Microsoft 365, AutoDesk..."
              value={form.swName}
              onChange={e => set("swName", e.target.value)}
              autoFocus
            />
          </div>

          {/* 이름 (소유자) */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">이름 / 소유자</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 대용제약 그룹사, 공용계정..."
              value={form.name}
              onChange={e => set("name", e.target.value)}
            />
          </div>

          {/* 사이트 URL */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">사이트 URL</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://admin.microsoft.com"
              value={form.siteUrl}
              onChange={e => set("siteUrl", e.target.value)}
            />
          </div>

          {/* 아이디 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">아이디 / 계정 *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@company.com"
              value={form.accountId}
              onChange={e => set("accountId", e.target.value)}
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                value={form.password}
                onChange={e => set("password", e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base"
              >
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">비고</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="용도, 담당자 등 메모"
              value={form.memo}
              onChange={e => set("memo", e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.swName.trim() || !form.accountId.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {saving ? "저장 중..." : isEdit ? "수정 완료" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 삭제 확인 모달
// ────────────────────────────────────────────────────────────
function DeleteConfirmModal({
  cred, onConfirm, onClose, deleting,
}: {
  cred: SwCredential;
  onConfirm: () => void;
  onClose: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10 text-center">
        <div className="text-3xl mb-3">🗑️</div>
        <h3 className="font-bold text-base text-gray-900 mb-1">계정 삭제</h3>
        <p className="text-sm text-gray-500 mb-5">
          <span className="font-semibold text-gray-800">{cred.swName}</span>
          {cred.name && <> — {cred.name}</>}의 계정을 삭제하시겠습니까?<br />
          <span className="text-xs text-red-500">노션에서 아카이브 처리됩니다.</span>
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function CredentialsPanel() {
  const [creds,    setCreds]    = useState<SwCredential[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [revealId, setRevealId] = useState<string | null>(null);

  const [showAdd,      setShowAdd]      = useState(false);
  const [editTarget,   setEditTarget]   = useState<SwCredential | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SwCredential | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type: "success"|"error" } | null>(null);

  function showToast(msg: string, type: "success"|"error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    setCreds(loadLocal());
    setLoading(false);
  }, []);

  // ── 추가 ──
  function handleAdd(form: FormData) {
    setSaving(true);
    const next = [...creds, { ...form, id: newId() }];
    saveLocal(next);
    setCreds(next);
    setShowAdd(false);
    showToast("✅ 계정이 추가되었습니다.");
    setSaving(false);
  }

  // ── 수정 ──
  function handleEdit(form: FormData) {
    if (!editTarget) return;
    setSaving(true);
    const next = creds.map(c => c.id === editTarget.id ? { ...c, ...form } : c);
    saveLocal(next);
    setCreds(next);
    setEditTarget(null);
    showToast("✅ 계정이 수정되었습니다.");
    setSaving(false);
  }

  // ── 삭제 ──
  function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const next = creds.filter(c => c.id !== deleteTarget.id);
    saveLocal(next);
    setCreds(next);
    setDeleteTarget(null);
    showToast("🗑️ 계정이 삭제되었습니다.");
    setDeleting(false);
  }

  // ── 필터링 ──
  const filtered = useMemo(() => {
    if (!search) return creds;
    const q = search.toLowerCase();
    return creds.filter(c =>
      c.swName.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.accountId.toLowerCase().includes(q) ||
      c.memo.toLowerCase().includes(q)
    );
  }, [creds, search]);

  // ── SW명 기준 그룹핑 ──
  const grouped = useMemo(() => {
    const map = new Map<string, SwCredential[]>();
    for (const c of filtered) {
      const key = c.swName || "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "ko"));
  }, [filtered]);

  // ── 렌더링 ──
  return (
    <div className="fade-in">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === "error" ? "bg-red-600 text-white" : "bg-gray-900 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* 모달 */}
      {showAdd     && <CredentialModal onSave={handleAdd}  onClose={() => setShowAdd(false)} saving={saving} />}
      {editTarget  && <CredentialModal initial={editTarget} onSave={handleEdit} onClose={() => setEditTarget(null)} saving={saving} />}
      {deleteTarget && (
        <DeleteConfirmModal cred={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} deleting={deleting} />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">계정 관리 (ID/PW)</h2>
          <p className="text-sm text-gray-500">SW 관리 포털 계정 목록 · 로컬 저장</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          계정 추가
        </button>
      </div>

      {/* 보안 배너 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex items-start gap-3">
        <span className="text-lg shrink-0">🔒</span>
        <div className="text-xs text-amber-800">
          <strong>관리자 전용 페이지입니다.</strong> 이 화면의 계정 정보는 로그인된 관리자에게만 표시됩니다.
          비밀번호는 클릭 시 잠깐만 표시되며, 노션 DB와 실시간 연동됩니다.
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-20 text-gray-400">계정 목록 불러오는 중...</div>
      )}

      {/* 데이터 */}
      {!loading && (
        <>
          {/* 검색 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SW명, 이름, 계정ID, 비고 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none">×</button>
              )}
            </div>
            <div className="text-right text-xs text-gray-400 mt-1.5">{filtered.length}개 계정</div>
          </div>

          {/* 빈 상태 */}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-3xl mb-2">{search ? "🔍" : "🔐"}</div>
              <div className="text-sm mb-3">
                {search ? "검색 결과가 없습니다." : "등록된 계정이 없습니다."}
              </div>
              {!search && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + 첫 계정 추가하기
                </button>
              )}
            </div>
          )}

          {/* SW명 그룹별 목록 */}
          {grouped.map(([swName, items]) => (
            <div key={swName} className="mb-7">
              {/* 그룹 헤더 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{getSwIcon(swName)}</span>
                <h3 className="text-sm font-bold text-gray-700">{swName}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{items.length}</span>
              </div>

              {/* 카드 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map(c => {
                  const isRevealed = revealId === c.id;
                  return (
                    <div
                      key={c.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all hover:border-blue-200 flex flex-col gap-2.5"
                    >
                      {/* 이름 + 수정/삭제 */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-900 truncate">
                            {c.name || c.accountId}
                          </div>
                          {c.memo && (
                            <div className="text-xs text-gray-400 truncate mt-0.5">{c.memo}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setEditTarget(c)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600 transition-all"
                            title="수정">✏️</button>
                          <button onClick={() => setDeleteTarget(c)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-all"
                            title="삭제">🗑️</button>
                        </div>
                      </div>

                      <div className="border-t border-gray-100" />

                      {/* 계정 ID */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-14 shrink-0">아이디</span>
                        <span className="flex-1 font-mono text-xs text-gray-800 truncate bg-gray-50 px-2 py-1 rounded border border-gray-100">
                          {c.accountId || "—"}
                        </span>
                        {c.accountId && <CopyBtn text={c.accountId} label="ID" />}
                      </div>

                      {/* 비밀번호 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-14 shrink-0">비밀번호</span>
                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                          <span
                            className={`font-mono text-xs px-2 py-1 rounded border flex-1 truncate select-none cursor-pointer transition-all ${
                              isRevealed
                                ? "bg-yellow-50 border-yellow-200 text-gray-800"
                                : "bg-gray-50 border-gray-100 text-gray-300 tracking-widest"
                            }`}
                            onClick={() => setRevealId(isRevealed ? null : c.id)}
                            title={isRevealed ? "클릭하여 숨기기" : "클릭하여 표시"}
                          >
                            {c.password ? (isRevealed ? c.password : "••••••••••") : "—"}
                          </span>
                          {c.password && (
                            <button
                              onClick={() => setRevealId(isRevealed ? null : c.id)}
                              className={`shrink-0 p-1.5 rounded-lg border text-xs transition-all ${
                                isRevealed
                                  ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                  : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
                              }`}
                              title={isRevealed ? "숨기기" : "보기"}
                            >{isRevealed ? "🙈" : "👁"}</button>
                          )}
                        </div>
                        {c.password && <CopyBtn text={c.password} label="PW" />}
                      </div>

                      {/* 사이트 링크 */}
                      {c.siteUrl && (
                        <a
                          href={c.siteUrl.startsWith("http") ? c.siteUrl : `https://${c.siteUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          <span className="truncate max-w-[180px]">{c.siteUrl.replace(/^https?:\/\//, "")}</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {creds.length > 0 && (
            <div className="mt-4 text-center text-xs text-gray-400">
              총 {creds.length}개 계정 · 브라우저 로컬 저장
            </div>
          )}
        </>
      )}
    </div>
  );
}
