import { atom } from "jotai";

// 접수 직후 화면(ticket/[ticketId])에 보여 줄 값 — 접수 폼이 제출 성공 때 채운다(useInquiryForm).
// v2 전환 뒤 포털은 접수 행을 다시 읽을 수 없어(암호문) 서버에서 받아 오지 않는다.
export const InquiryTicket법인Atom = atom<string>("");
export const InquiryTicket부서Atom = atom<string>("");
export const InquiryTicket문의자Atom = atom<string>("");
export const InquiryTicket자산번호Atom = atom<string>("");
export const InquiryTicket문의유형Atom = atom<string>("");
export const InquiryTicket문의내용Atom = atom<string>("");
export const InquiryTicket긴급도Atom = atom<string>("");

export const InquiryTicketCreatedTimeAtom = atom<string>("");
/** [이 매뉴얼로 해결]이 이 문의에서 온 것임을 보이는 서명(lib/resolve-token.ts) */
export const InquiryTicketResolveTokenAtom = atom<string>("");
