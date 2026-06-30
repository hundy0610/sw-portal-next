import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";

const KV_SURVEY = "portal:survey_responses";

export interface SurveyResponse {
  id: string;
  corp: string;
  dept: string;
  name: string;
  email: string;
  purposes: string[];
  purposeEtc?: string;
  languages: string[];
  languageEtc?: string;
  frequency: string;
  frequencyEtc?: string;
  note?: string;
  submittedAt: string;
}

export async function GET() {
  try {
    const data = (await kvGet<SurveyResponse[]>(KV_SURVEY)) ?? [];
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry: SurveyResponse = {
      id:           `sv_${Date.now()}`,
      corp:         body.corp         ?? "",
      dept:         body.dept         ?? "",
      name:         body.name         ?? "",
      email:        body.email        ?? "",
      purposes:     body.purposes     ?? [],
      purposeEtc:   body.purposeEtc   ?? "",
      languages:    body.languages    ?? [],
      languageEtc:  body.languageEtc  ?? "",
      frequency:    body.frequency    ?? "",
      frequencyEtc: body.frequencyEtc ?? "",
      note:         body.note         ?? "",
      submittedAt:  new Date().toISOString(),
    };

    const all = (await kvGet<SurveyResponse[]>(KV_SURVEY)) ?? [];
    await kvSetPermanent(KV_SURVEY, [entry, ...all]);

    return NextResponse.json({ ok: true, id: entry.id });
  } catch (e) {
    console.error("[survey] POST error:", e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
