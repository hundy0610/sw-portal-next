"use client";

import { useAtom, useAtomValue } from "jotai";
import {
  InquiryForm긴급도Atom,
  InquiryForm문의내용Atom,
  InquiryForm문의유형Atom,
  InquiryForm문의자Atom,
  InquiryForm법인Atom,
  InquiryForm부서Atom,
  InquiryForm자산번호Atom,
  InquiryForm이메일Atom,
} from "@/app/request/inquiry/(atoms)/useInquiryFormStore";
import {
  InquiryOptions긴급도Atom,
  InquiryOptions문의유형Atom,
  InquiryOptions법인Atom,
} from "@/app/request/inquiry/(atoms)/useInquiryOptionsStore";
import { useInquiryForm } from "@/app/request/inquiry/(hooks)/useInquiryForm";
import { useInquiryOptions } from "@/app/request/inquiry/(hooks)/useInquiryOptions";
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

export default function Inquiry() {
  const { isLoading, error } = useInquiryOptions();
  const { isSubmitting, error: submitError, handleSubmit } = useInquiryForm();

  const 법인Options = useAtomValue(InquiryOptions법인Atom);
  const 문의유형Options = useAtomValue(InquiryOptions문의유형Atom);
  const 긴급도Options = useAtomValue(InquiryOptions긴급도Atom);

  const [법인, set법인] = useAtom(InquiryForm법인Atom);
  const [부서, set부서] = useAtom(InquiryForm부서Atom);
  const [문의자, set문의자] = useAtom(InquiryForm문의자Atom);
  const [자산번호, set자산번호] = useAtom(InquiryForm자산번호Atom);
  const [문의유형, set문의유형] = useAtom(InquiryForm문의유형Atom);
  const [문의내용, set문의내용] = useAtom(InquiryForm문의내용Atom);
  const [긴급도, set긴급도] = useAtom(InquiryForm긴급도Atom);
  const [이메일, set이메일] = useAtom(InquiryForm이메일Atom);

  if (isLoading) {
    return <LoadingComponent />;
  }

  if (error) {
    return <ErrorComponent errorMessage={error.message} />;
  }

  return (
    <Container>
      <Header title="Inquiry" highlighted="Form" />
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
        <FormField title="이메일" description="그룹웨어 이메일을 적어주세요." required>
          <TextInput placeholder="ex. example@company.com" value={이메일} onChange={set이메일} required />
        </FormField>
        <FormField title="자산 번호" description="사용중인 기기에 붙어있는 자산 번호를 적어주세요.">
          <TextInput placeholder="ex. 2309-N0001" value={자산번호} onChange={set자산번호} />
        </FormField>
        <FormField title="문의 유형" description="필요하신 지원 유형을 골라주세요." required>
          <RadioOption options={문의유형Options} value={문의유형} onChange={set문의유형} />
        </FormField>
        <FormField title="문의 내용" description="필요한 도움이나 요청 사항을 구체적으로 입력해 주세요." required>
          <RichTextInput
            placeholder="ex. 오늘 아침부터 노트북의 전원이 켜지지 않아요."
            required
            value={문의내용}
            onChange={set문의내용}
          />
        </FormField>
        <FormField title="긴급도" required>
          <RadioOption options={긴급도Options} value={긴급도} onChange={set긴급도} required />
        </FormField>
        {submitError && (
          <span className="w-full text-center text-label text-red-500">{submitError}</span>
        )}
        <SubmitButton text="제출하기" isLoading={isSubmitting} />
      </FormFieldList>
    </Container>
  );
}
