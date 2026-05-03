# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# 사내 웹 프로젝트 개발 지침 (Claude Code용)

이 문서는 사내 웹 페이지 프로젝트의 협업 및 개발 표준 절차를 정의합니다. Claude는 모든 작업 시 이 가이드라인을 엄격히 준수해야 합니다.

## 1. 프로젝트 개요 및 구조

- **프로젝트 성격:** 사내 메인 프로젝트에 속한 웹 페이지 개발.
- **페이지 구성:**
  - **User Page:** 일반 사용자용 인터페이스.
  - **Admin Page:** 시스템 관리자용 인터페이스.
  - **Manage Page:** User Page 관리용 인터페이스.
- **기술 스택:** React (Main Library), Notion (Database).

## 2. 개발 및 테스트 원칙 (Local First)

- **배포 환경:** Vercel을 통해 배포되나, 현재 계정 권한 문제로 실시간 반영 확인이 어렵습니다.
- **필수 절차:**
  1. 코드 수정 후 반드시 **로컬 서버(`npm run dev` 등)**에서 기능을 완벽히 테스트합니다.
  2. UI 반영 및 로직 정상 작동을 확인한 후에만 다음 단계로 진행합니다.
- **DB 연동:** Notion API를 통해 데이터를 주고받으므로, API 호출 최적화 및 에러 핸들링에 주의합니다.

### 프로젝트 경로

**구조:**
- 소스 코드 (주 작업): `/Users/natural_fox/works/SW_PORTAL` (로컬 Mac SSD)
- NAS 미러: `/Volumes/personal_folder/NAS/works/github/sw-portal-next/` (동기화 대상)

**개발 서버 실행:**
```bash
cd /Users/natural_fox/works/SW_PORTAL
npm run dev
```

**의존성 추가 시:**
```bash
cd /Users/natural_fox/works/SW_PORTAL && npm install <패키지명>
```

**NAS 동기화:**
로컬에서 커밋·머지 후 GitHub push → NAS에서 `git pull origin master`

## 3. Git 워크플로우 및 브랜치 전략

모든 작업은 협업 규칙에 따라 특정 브랜치에서만 수행합니다.

- **작업 브랜치:** 반드시 `Natural_Fox` 브랜치에 커밋해야 합니다.
- **커밋 메시지:** 어떤 변경 사항이 있었는지 구체적으로 작성합니다.
  - 형식: `[수정/기능/버그] 상세 변경 내용 기록`
- **머지(Merge) 절차:**
  - 커밋이 완료된 후, Claude는 반드시 사용자에게 다음과 같이 질문해야 합니다.
  - **"현재 변경 사항을 메인 브랜치(master)에 머지할까요?"**
  - 사용자의 승인이 있을 때만 머지 작업을 검토하거나 진행합니다.

## 4. Claude 행동 지침

1. 작업 시작 전 현재 브랜치가 `Natural_Fox`인지 확인하고, 아니면 전환할 것.
2. Notion DB 스키마 변경 시 관련 컴포넌트의 영향을 반드시 체크할 것.
3. 로컬 테스트 결과에 이상이 없을 때만 커밋을 제안할 것.
4. `master` 브랜치로의 직접 커밋은 절대 금지하며, 반드시 승인 후 머지 프로세스를 밟을 것.
