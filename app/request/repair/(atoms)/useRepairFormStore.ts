import { atom } from "jotai";

export const RepairForm법인Atom = atom<string>("");
export const RepairForm부서Atom = atom<string>("");
export const RepairForm문의자Atom = atom<string>("");
export const RepairForm건물명Atom = atom<string>("");
export const RepairForm층수Atom = atom<string>("");
export const RepairForm모니터번호Atom = atom<string>("");
export const RepairForm고장내역Atom = atom<string>("");
export const RepairForm세부내역Atom = atom<string>("");
/** QR 스캔으로 접수됐을 때만 채워진다(배치도 좌석 ID, ?itemId= 쿼리로 전달) — 있으면
 * 모니터 번호 필드를 자동으로 채우고 잠근다. */
export const RepairFormItemIdAtom = atom<string>("");
