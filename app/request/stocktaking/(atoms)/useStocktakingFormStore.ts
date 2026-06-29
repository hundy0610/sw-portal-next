import { atom } from "jotai";

export const StocktakingFormAssetIdAtom = atom<string>("");

export const StocktakingFoundPageIdAtom = atom<string | null>(null);
export const StocktakingFound법인명Atom = atom<string>("");
export const StocktakingFound부서Atom = atom<string>("");
export const StocktakingFound사용자Atom = atom<string>("");
export const StocktakingFound제조사Atom = atom<string>("");
export const StocktakingFound실사확인Atom = atom<boolean>(false);

export const StocktakingManual법인명Atom = atom<string>("");
export const StocktakingManual부서Atom = atom<string>("");
export const StocktakingManual사용자Atom = atom<string>("");

export const StocktakingStepAtom = atom<"input" | "confirm" | "manual">("input");
