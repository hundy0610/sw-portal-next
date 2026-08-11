# 중앙 DB 콜드 스페어 구성 (Windows PC)

> 지금 중앙 DB(맥북 1대, 자체 호스팅 Supabase)가 **단일 장애점**이라, 죽었을 때
> 수동으로 갈아탈 수 있는 예비 장비를 Windows PC에 만든다. 평소엔 이 장비가
> 서비스 트래픽을 받지 않는다("콜드") — 맥북이 죽었을 때만 사람이 직접 승격시킨다.
> 실시간 이중화(자동 failover)가 아니다. 그건 훨씬 복잡하고 지금 규모엔 과함.

관련 문서: **[ARCHITECTURE-4.0.md](ARCHITECTURE-4.0.md)** (현재 맥북 구성의 전체 그림).
이 문서는 그 구성을 Windows에 "복제"하고 **주기적으로 최신 데이터를 당겨오는** 방법을
다룬다.

---

## 0. 설계 요약

| 항목 | 맥북(현재, 메인) | Windows PC(신규, 스페어) |
|---|---|---|
| 역할 | 서비스 중 — Vercel이 실제로 붙는 곳 | 평소엔 대기. 승격 전까진 아무도 안 씀 |
| 소프트웨어 | Docker + 자체 호스팅 Supabase | 동일 |
| 데이터 | 실시간 원본 | **매일 밤 맥북 백업을 받아 복원**(최대 1일 차이) |
| 노출 | Tailscale Funnel (8000) | 평소엔 Funnel 꺼둬도 됨 — 승격 시에만 켬 |
| Vercel 연결 | `SUPABASE_URL`이 맥북 Funnel 주소 | 승격 시 이 값을 Windows Funnel 주소로 교체 |

⚠️ **kv 테이블(계정·설정 등)은 Notion 백업 대상이 아니다.** `entity_store`/`hw`는
Notion에도 5분마다 백업되지만, `public.kv`(로그인 계정, 공지, 카드명세, 알림 설정 등)는
**이 DB 자체가 유일한 원본**이다. 그래서 "Notion에서 다시 시딩하면 되지 않나"로는
부족하고, **DB 전체를 통째로 백업/복원**하는 방식으로 간다.

---

## 1. Windows PC 준비

1. **Docker Desktop** 설치 (WSL2 백엔드로) — https://www.docker.com/products/docker-desktop
   - 설치 중 "Use WSL 2 instead of Hyper-V" 선택
   - 설치 후 Docker Desktop → Settings → General → *Start Docker Desktop when you sign in* 체크
     (맥북 쪽 `ARCHITECTURE-4.0.md` §8의 "Docker Desktop 로그인 시 자동 실행"과 동일한 이유)
2. **Tailscale** 설치 — https://tailscale.com/download/windows, 같은 tailnet(맥북과 동일 계정)으로 로그인
3. **OpenSSH 클라이언트** 활성화 (백업 파일을 맥북에서 당겨올 때 `scp` 사용) —
   Windows 10/11엔 보통 기본 포함. 없으면: 설정 → 앱 → 선택적 기능 → "OpenSSH 클라이언트" 추가
4. **절전 방지** — 이 PC가 정기적으로 백업을 받으려면 예약 실행 시각에 켜져 있어야 한다.
   전원 옵션에서 최소한 "USB 선택적 절전 사용 안 함", 필요시 절전 모드 안 함으로 설정.
   완전 24/7까지는 필요 없다 — 백업 스케줄 시각(예: 매일 새벽 2시)에만 켜져 있으면 된다.

---

## 2. 자체 호스팅 Supabase 설치

맥북과 동일하게 Supabase 공식 self-hosting 스택을 그대로 쓴다.

```powershell
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
copy .env.example .env
```

`.env`를 열어 최소한 아래 값들을 **새로 생성**해서 채운다(맥북 값과 같을 필요 없음 —
승격 시 Vercel의 `SUPABASE_KEY`도 같이 바꿀 것이므로):
- `POSTGRES_PASSWORD`
- `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` (JWT_SECRET으로 재생성 필요 —
  Supabase 공식 문서의 "Generate API Keys" 절차를 따른다)

```powershell
docker compose up -d
```

정상 기동하면 `http://localhost:8000`에서 Kong(PostgREST 게이트웨이)이 응답한다.

---

## 3. 스키마 적용

이 레포에서(Windows PC에 레포를 clone해 두거나, 다른 PC에서 원격으로) 스키마만 적용한다.

```bash
# 이 PC의 Postgres에 직접 연결하는 값으로 .env 설정
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=<위에서 설정한 POSTGRES_PASSWORD>
PGDATABASE=postgres

npm run migrate   # scripts/sql/001~003 순서대로 적용 (hw, kv, entity_store 테이블 생성)
```

이 시점에서 테이블 구조는 맥북과 동일해지지만 **데이터는 비어있다.** 데이터는 4번의
백업/복원으로 채운다(최초 1회는 수동으로 한 번 돌려서 확인).

---

## 4. 백업(맥북) → 복원(Windows) 스케줄

### 4-1. 맥북: 매일 백업 파일 생성

`scripts/backup-central-db.sh` (이번에 추가) 를 launchd로 매일 새벽에 실행 —
`deploy/com.swportal.backup-notion.plist`와 같은 방식으로 plist 하나 더 등록하면 된다.
백업 파일은 `pg_dump` 커스텀 포맷(`-Fc`)으로 `~/swportal-backups/`에 쌓이고, 오래된 것은
자동 정리된다.

### 4-2. Windows PC: 예약 작업으로 최신 백업을 당겨와 복원

`scripts/restore-to-spare.ps1` (이번에 추가)을 **작업 스케줄러**에 등록:

```powershell
schtasks /create /tn "SW-Portal 스페어 DB 동기화" /tr "powershell.exe -File C:\path\to\restore-to-spare.ps1" /sc daily /st 02:30
```

이 스크립트는:
1. `scp`로 맥북의 최신 백업 파일을 Tailscale IP를 통해 가져온다
2. Windows 쪽 Postgres에 `pg_restore --clean`으로 덮어쓴다(기존 스페어 데이터는 매번 초기화됨 — 콜드 스페어라 문제 없음)
3. 성공/실패를 로그 파일에 남긴다

**최초 설정 시**: 맥북에서 SSH 접속을 허용해야 한다(시스템 설정 → 공유 → 원격 로그인 켜기),
그리고 Windows에서 맥북으로 비밀번호 없이 접속되도록 SSH 키 등록을 한 번 해둔다
(`ssh-keygen` → 공개키를 맥북의 `~/.ssh/authorized_keys`에 추가).

---

## 5. 승격(failover) 절차 — 맥북이 죽었을 때

1. Windows PC에서 Tailscale Funnel 켜기: `tailscale funnel --bg 8000`
2. Funnel 주소 확인: `tailscale funnel status`
3. **최신 백업이 반영됐는지 확인** — 최악의 경우 최대 1일치 데이터 손실 가능성이
   있으므로, 가능하면 승격 직전에 수동으로 `restore-to-spare.ps1`을 한 번 더 돌려
   최신화 시도(맥북이 완전히 죽었으면 이 단계는 실패하니 스킵하고 마지막 백업으로 진행)
4. Vercel 환경변수 교체 (Production):
   - `SUPABASE_URL` → Windows PC의 Funnel 주소
   - `SUPABASE_KEY` → Windows PC에서 생성한 `SERVICE_ROLE_KEY`
5. Vercel 재배포(환경변수 변경은 새 배포부터 반영됨 — 기존 배포 재배포 또는 빈 커밋 푸시)
6. 맥북 launchd 백업 잡(Notion 백업, 5분 주기)도 **이 시점부터는 Windows PC에서 돌아야
   한다** — `scripts/backup-to-notion.ts`를 Windows용 스케줄(작업 스케줄러, 5분 간격)로
   등록. (맥북이 나중에 복구되면 반대로 다시 정리)

---

## 6. 앞으로 만들 것 (이번엔 설계만, 코드는 다음 단계)

- `scripts/backup-central-db.sh` — 맥북용 pg_dump 스크립트
- `scripts/restore-to-spare.ps1` — Windows용 복원 스크립트
- `deploy/com.swportal.backup-central-db.plist` — 위 백업 스크립트를 매일 실행하는 launchd 유닛

바로 이어서 이 3개 파일을 만들 예정이다.
