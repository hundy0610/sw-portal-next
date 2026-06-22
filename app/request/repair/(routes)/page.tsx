"use client";

import { useAtom, useAtomValue } from "jotai";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import {
  RepairForm건물명Atom,
  RepairForm고장내역Atom,
  RepairForm모니터번호Atom,
  RepairForm문의자Atom,
  RepairForm법인Atom,
  RepairForm부서Atom,
  RepairForm세부내역Atom,
  RepairForm층수Atom,
} from "@/app/request/repair/(atoms)/useRepairFormStore";
import {
  RepairOptions건물명Atom,
  RepairOptions고장내역Atom,
  RepairOptions법인Atom,
} from "@/app/request/repair/(atoms)/useRepairOptionsStore";
import { useRepairForm } from "@/app/request/repair/(hooks)/useRepairForm";
import { useRepairOptions } from "@/app/request/repair/(hooks)/useRepairOptions";
import Container from "@/shared/components/common/container";
import ErrorComponent from "@/shared/components/common/errorComponent";
import Header from "@/shared/components/common/header";
import LoadingComponent from "@/shared/components/common/loadingComponent";
import {
  FormField,
  FormFieldList,
  RadioOption,
  RichTextInput,
  SelectOption,
  TextInput,
} from "@/shared/components/form/form-fields";
import SubmitButton from "@/shared/components/form/submit-button";

function RepairWarningModal({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-solid-black/50 px-spacing-400">
      <div className="flex w-full max-w-md flex-col gap-spacing-550 rounded-radius-700 bg-background-standard-primary p-spacing-700 shadow-xl">
        <div className="flex items-start gap-spacing-400">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-radius-full bg-solid-translucent-orange">
            <TriangleAlert className="h-5 w-5 text-solid-orange" />
          </div>
          <div className="flex flex-col gap-spacing-200">
            <span className="font-semibold text-content-standard-primary text-heading">수리 접수 전 확인해주세요</span>
            <span className="text-body text-content-standard-secondary">
              이 페이지는 <strong className="text-content-standard-primary">모니터 파손 문의</strong>만 접수받고
              있습니다.
            </span>
            <ul className="flex flex-col gap-spacing-100 text-body text-content-standard-secondary">
              <li className="flex items-center gap-spacing-200">
                <span className="h-1.5 w-1.5 shrink-0 rounded-radius-full bg-solid-orange" />
                액정 파손 · 화면 깨짐
              </li>
              <li className="flex items-center gap-spacing-200">
                <span className="h-1.5 w-1.5 shrink-0 rounded-radius-full bg-solid-orange" />줄 생김 · 잔상 · 얼룩
              </li>
              <li className="flex items-center gap-spacing-200">
                <span className="h-1.5 w-1.5 shrink-0 rounded-radius-full bg-solid-orange" />
                화면 불량 · 전원 불량
              </li>
            </ul>
            <span className="rounded-radius-300 bg-solid-translucent-orange px-spacing-300 py-spacing-200 text-content-standard-secondary text-label">
              노트북, 데스크탑 등 다른 기기 문의는 이곳에 접수되어도{" "}
              <strong className="text-solid-orange">처리되지 않습니다.</strong>
            </span>
          </div>
        </div>
        <div className="flex gap-spacing-300">
          <a
            href="/request/inquiry"
            className="flex flex-1 items-center justify-center rounded-radius-400 bg-components-fill-standard-secondary px-spacing-500 py-spacing-400 duration-100 hover:opacity-75 active:scale-95">
            <span className="font-semibold text-content-standard-primary text-label">문의 폼으로 이동</span>
          </a>
          <button
            type="button"
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center rounded-radius-400 bg-core-accent px-spacing-500 py-spacing-400 duration-100 hover:opacity-75 active:scale-95">
            <span className="font-semibold text-content-inverted-primary text-label">수리 접수 진행</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Repair() {
  const [showWarning, setShowWarning] = useState(true);
  const { isLoading, error } = useRepairOptions();

  const 법인Options = useAtomValue(RepairOptions법인Atom);
  const 건물명Options = useAtomValue(RepairOptions건물명Atom);
  const 고장내역Options = useAtomValue(RepairOptions고장내역Atom);

  const [법인, set법인] = useAtom(RepairForm법인Atom);
  const [부서, set부서] = useAtom(RepairForm부서Atom);
  const [문의자, set문의자] = useAtom(RepairForm문의자Atom);
  const [건물명, set건물명] = useAtom(RepairForm건물명Atom);
  const [층수, set층수] = useAtom(RepairForm층수Atom);
  const [모니터번호, set모니터번호] = useAtom(RepairForm모니터번호Atom);
  const [고장내역, set고장내역] = useAtom(RepairForm고장내역Atom);
  const [세부내역, set세부내역] = useAtom(RepairForm세부내역Atom);

  const { isSubmitting, handleSubmit } = useRepairForm();

  if (isLoading) {
    return <LoadingComponent />;
  }

  if (error) {
    return <ErrorComponent errorMessage={error.message} />;
  }

  return (
    <>
      {showWarning && <RepairWarningModal onConfirm={() => setShowWarning(false)} />}
      <Container>
        <Header title="Repair" highlighted="Form" />
        <FormFieldList onSubmit={handleSubmit}>
          <FormField title="법인명" required>
            <SelectOption options={법인Options} value={법인} onChange={set법인} required />
          </FormField>
          <FormField title="부서">
            <TextInput placeholder="ex. 경영지원팀 or 자산관리파트" value={부서} onChange={set부서} />
          </FormField>
          <FormField title="문의자 성함" required>
            <TextInput placeholder="ex. 김자산" value={문의자} onChange={set문의자} required />
          </FormField>
          <FormField title="건물명" required>
            <SelectOption options={건물명Options} value={건물명} onChange={set건물명} required />
          </FormField>
          <FormField title="층수" required>
            <TextInput placeholder="ex. 3층" value={층수} onChange={set층수} required />
          </FormField>
          <FormField title="모니터 번호" required>
            <TextInput placeholder="ex. 2309-N0001" value={모니터번호} onChange={set모니터번호} required />
          </FormField>
          <FormField title="고장 내역" description="고장 유형을 선택해 주세요." required>
            <RadioOption options={고장내역Options} value={고장내역} onChange={set고장내역} required />
          </FormField>
          <FormField title="세부 내역" description="고장 증상을 구체적으로 입력해 주세요.">
            <RichTextInput
              placeholder="ex. 화면 중앙에 세로줄이 생기고 간헐적으로 깜빡입니다."
              value={세부내역}
              onChange={set세부내역}
            />
          </FormField>
          <SubmitButton text="제출하기" isLoading={isSubmitting} />
        </FormFieldList>
      </Container>
    </>
  );
}
