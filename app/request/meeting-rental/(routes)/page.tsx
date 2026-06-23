"use client";

import { useAtom, useAtomValue } from "jotai";
import {
  MeetingRentalForm법인명Atom,
  MeetingRentalForm부서Atom,
  MeetingRentalForm시작일시Atom,
  MeetingRentalForm신청자Atom,
  MeetingRentalForm이메일Atom,
  MeetingRentalForm종료일시Atom,
} from "@/app/request/meeting-rental/(atoms)/useMeetingRentalFormStore";
import { MeetingRentalOptions법인명Atom } from "@/app/request/meeting-rental/(atoms)/useMeetingRentalOptionsStore";
import { useMeetingRentalForm } from "@/app/request/meeting-rental/(hooks)/useMeetingRentalForm";
import { useMeetingRentalOptions } from "@/app/request/meeting-rental/(hooks)/useMeetingRentalOptions";
import Container from "@/shared/components/common/container";
import ErrorComponent from "@/shared/components/common/errorComponent";
import Header from "@/shared/components/common/header";
import LoadingComponent from "@/shared/components/common/loadingComponent";
import { FormField, FormFieldList, SelectOption, TextInput } from "@/shared/components/form/form-fields";
import SubmitButton from "@/shared/components/form/submit-button";

export default function MeetingRental() {
  const { isLoading, error } = useMeetingRentalOptions();
  const { isSubmitting, error: submitError, handleSubmit } = useMeetingRentalForm();

  const 법인명Options = useAtomValue(MeetingRentalOptions법인명Atom);

  const [법인명, set법인명] = useAtom(MeetingRentalForm법인명Atom);
  const [부서, set부서] = useAtom(MeetingRentalForm부서Atom);
  const [신청자, set신청자] = useAtom(MeetingRentalForm신청자Atom);
  const [이메일, set이메일] = useAtom(MeetingRentalForm이메일Atom);
  const [시작일시, set시작일시] = useAtom(MeetingRentalForm시작일시Atom);
  const [종료일시, set종료일시] = useAtom(MeetingRentalForm종료일시Atom);

  if (isLoading) {
    return <LoadingComponent />;
  }

  if (error) {
    return <ErrorComponent errorMessage={error.message} />;
  }

  return (
    <Container>
      <Header title="Meeting" highlighted="Rental" />
      <FormFieldList onSubmit={handleSubmit}>
        <FormField title="법인명" required>
          <SelectOption options={법인명Options} value={법인명} onChange={set법인명} required />
        </FormField>
        <FormField title="부서">
          <TextInput placeholder="ex. 경영지원팀 or 자산관리파트" value={부서} onChange={set부서} />
        </FormField>
        <FormField title="신청자" required>
          <TextInput placeholder="ex. 김자산" value={신청자} onChange={set신청자} required />
        </FormField>
        <FormField title="신청자 이메일" description="그룹웨어 이메일을 적어주세요." required>
          <TextInput placeholder="ex. example@company.com" value={이메일} onChange={set이메일} required />
        </FormField>
        <FormField title="신청 기간" description="회의실 무선 장비를 대여할 날짜와 시간을 선택해 주세요." required>
          <div className="flex w-full items-center gap-spacing-200">
            <TextInput type="datetime-local" value={시작일시} onChange={set시작일시} required />
            <span className="text-content-standard-secondary text-label">~</span>
            <TextInput type="datetime-local" value={종료일시} onChange={set종료일시} required />
          </div>
        </FormField>
        {submitError && (
          <span className="w-full text-center text-label text-red-500">{submitError}</span>
        )}
        <SubmitButton text="제출하기" isLoading={isSubmitting} />
      </FormFieldList>
    </Container>
  );
}
