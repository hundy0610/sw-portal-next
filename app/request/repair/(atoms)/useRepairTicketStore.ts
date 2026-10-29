import { atom } from "jotai";

// 접수 직후 화면(ticket/[ticketId])에 보여 줄 값 — 접수 폼이 제출 성공 때 채운다(useRepairForm).
// v2 전환 뒤 포털은 접수 행을 다시 읽을 수 없어(암호문) 서버에서 받아 오지 않는다.
export const RepairTicket법인Atom = atom<string>("");
export const RepairTicket부서Atom = atom<string>("");
export const RepairTicket문의자Atom = atom<string>("");
export const RepairTicket건물명Atom = atom<string>("");
export const RepairTicket층수Atom = atom<string>("");
export const RepairTicket모니터번호Atom = atom<string>("");
export const RepairTicket고장내역Atom = atom<string>("");
export const RepairTicket세부내역Atom = atom<string>("");

export const RepairTicketCreatedTimeAtom = atom<string>("");
