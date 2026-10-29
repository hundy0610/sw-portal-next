import { atom } from "jotai";

// 접수 직후 화면(ticket/[ticketId])에 보여 줄 값 — 신청 폼이 제출 성공 때 채운다(useMeetingRentalForm).
// v2 전환 뒤 포털은 접수 행을 다시 읽을 수 없어(암호문) 서버에서 받아 오지 않는다.
export const MeetingRentalTicket법인명Atom = atom<string>("");
export const MeetingRentalTicket부서Atom = atom<string>("");
export const MeetingRentalTicket신청자Atom = atom<string>("");
export const MeetingRentalTicket이메일Atom = atom<string>("");
export const MeetingRentalTicket시작일시Atom = atom<string>("");
export const MeetingRentalTicket종료일시Atom = atom<string>("");
export const MeetingRentalTicketCreatedTimeAtom = atom<string>("");
