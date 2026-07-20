import { ACTION_TREE } from "@/lib/action-categories";

// 조치분류 소분류(대분류 > 소분류)별 키워드 사전
// components/admin/HelpDeskPanel.tsx의 SW_SUBCATS/HW_SUBCATS 키워드 매칭 방식을 조치분류 체계에 맞춰 재구성
const KEYWORDS: Record<string, string[]> = {
  "하드웨어 > 단순 점검": ["점검", "확인 부탁", "이상 없는지", "상태 확인"],
  "하드웨어 > 청소 및 정비": ["먼지", "청소", "팬소음", "소음", "발열", "과열"],
  "하드웨어 > 부품 교체": ["부품", "배터리", "키보드", "마우스", "충전기", "어댑터", "메모리", "ssd", "하드"],
  "하드웨어 > 외부업체 수리": ["외부수리", "as센터", "공식as", "수리업체", "액정", "파손", "깨짐"],
  "하드웨어 > 자산 교체(노후화)": ["노후", "오래된", "느려요", "느림", "성능저하", "교체희망"],
  "하드웨어 > 자산 교체(고장 및 파손)": ["고장", "파손", "침수", "화면깨짐", "전원안됨", "부팅안됨", "꺼짐"],

  "소프트웨어 > OS 점검": ["오류코드", "블루스크린", "시스템오류", "os오류", "충돌"],
  "소프트웨어 > OS 재설치": ["포맷", "재설치", "os재설치", "윈도우재설치", "초기화", "부팅불가"],
  "소프트웨어 > 드라이버 업데이트": ["드라이버", "인식이 안", "인식안됨", "프린터연결", "블루투스페어링", "장치인식"],
  "소프트웨어 > 악성코드 점검": ["악성코드", "바이러스", "백신", "멀웨어", "랜섬웨어"],
  "소프트웨어 > 충돌 보안프로그램 점검": ["보안프로그램", "백신충돌", "방화벽", "프로그램충돌", "실행안됨"],
  "소프트웨어 > 라이선스 재고 지급": ["재고", "여분", "예비라이선스"],
  "소프트웨어 > 라이선스 신규구매 안내": ["신규구매", "구매요청", "라이선스구매", "신청방법"],
  "소프트웨어 > 라이선스 갱신 안내": ["갱신", "만료", "기한연장", "연장요청"],
  "소프트웨어 > 라이선스 설치": ["설치", "install", "라이선스", "인증키", "활성화", "한글", "hwp", "한컴", "office", "오피스"],
  "소프트웨어 > 라이선스 계정 관리": ["계정", "로그인", "비밀번호", "패스워드", "id변경", "권한"],

  "기타 > 단순 안내": ["문의드립니다", "안내", "방법 알려", "어떻게"],
  "기타 > 자산 반납": ["반납", "회수"],
  "기타 > 자산 이관": ["이관", "인계", "양도"],
  "기타 > 타부서 이관": ["타부서", "다른부서", "부서이관"],
};

export const ALL_ACTION_CATEGORY_KEYS = ACTION_TREE.flatMap(g => g.children.map(c => `${g.label} > ${c}`));

export interface ActionCategoryMatch {
  category: string;
  hits: number;
}

// 문의 내용/제목/유형 텍스트에서 키워드 히트 수가 가장 많은 조치분류 소분류를 추정
export function classifyActionCategory(content: string, title: string, inquiryType: string): ActionCategoryMatch | null {
  const text = [content, title, inquiryType].join(" ").toLowerCase();

  let best: string | null = null;
  let bestHits = 0;
  for (const category of ALL_ACTION_CATEGORY_KEYS) {
    const keywords = KEYWORDS[category];
    if (!keywords) continue;
    const hits = keywords.filter(k => text.includes(k.toLowerCase())).length;
    if (hits > bestHits) { bestHits = hits; best = category; }
  }

  return best ? { category: best, hits: bestHits } : null;
}
