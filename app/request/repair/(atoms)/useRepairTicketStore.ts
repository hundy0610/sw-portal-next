import { atom } from "jotai";

export const RepairTicket법인Atom = atom<string>("");
export const RepairTicket부서Atom = atom<string>("");
export const RepairTicket문의자Atom = atom<string>("");
export const RepairTicket건물명Atom = atom<string>("");
export const RepairTicket층수Atom = atom<string>("");
export const RepairTicket모니터번호Atom = atom<string>("");
export const RepairTicket고장내역Atom = atom<string>("");
export const RepairTicket세부내역Atom = atom<string>("");

export const RepairTicket상태Atom = atom<string>("");
export const RepairTicket조치내용Atom = atom<string>("");
export const RepairTicket담당자Atom = atom<string>("");
export const RepairTicket과실여부Atom = atom<string>("");
export const RepairTicket수리일정Atom = atom<string>("");
export const RepairTicket단가Atom = atom<number>(0);
export const RepairTicket수리진행상황Atom = atom<string>("");

export const RepairTicketCreatedTimeAtom = atom<string>("");
