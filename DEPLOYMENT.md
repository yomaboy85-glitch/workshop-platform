# 🚀 워크샵 플랫폼 배포 가이드

## 📋 전제 조건
- GitHub 계정 (무료)
- Supabase 계정 (무료) → https://supabase.com
- Vercel 계정 (무료) → https://vercel.com

---

## Step 1: Supabase 프로젝트 설정

### 1-1. 프로젝트 생성
1. https://supabase.com 접속 → 로그인
2. "New Project" 클릭
3. 프로젝트 이름: `workshop-platform`
4. 데이터베이스 비밀번호 설정 (기억해두세요)
5. 지역: Northeast Asia (ap-northeast-1) 선택
6. "Create new project" 클릭

### 1-2. 데이터베이스 스키마 실행
1. 좌측 메뉴 → "SQL Editor" 클릭
2. `supabase/schema.sql` 파일 전체 내용 복사
3. SQL Editor에 붙여넣기 → "Run" 클릭
4. 오류 없이 완료되면 성공

### 1-3. API 키 확인
1. 좌측 메뉴 → Settings → API
2. 아래 두 가지 값을 메모:
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon public key**: `eyJ...` (긴 문자열)

### 1-4. Realtime 활성화 확인
1. 좌측 메뉴 → Database → Replication
2. `games`, `scores`, `teams`, `treasures`, `announcements`, `users`, `team_members` 테이블이 모두 체크되어 있는지 확인
3. 없으면 체크 추가

---

## Step 2: GitHub에 코드 올리기

```bash
# 1. 프로젝트 폴더로 이동
cd workshop-platform

# 2. .env.local 파일 생성
cp .env.local.example .env.local
# .env.local 파일을 열어 Supabase URL과 KEY 입력

# 3. 로컬 테스트 (선택사항)
npm install
npm run dev
# http://localhost:3000 에서 확인

# 4. GitHub 리포지토리 생성 후 푸시
git init
git add .
git commit -m "Initial commit: Workshop Platform"
git remote add origin https://github.com/YOUR_USERNAME/workshop-platform.git
git push -u origin main
```

---

## Step 3: Vercel 배포

### 3-1. Vercel에서 임포트
1. https://vercel.com 접속 → 로그인
2. "Add New Project" → "Import Git Repository"
3. GitHub 연결 → `workshop-platform` 리포 선택
4. "Import" 클릭

### 3-2. 환경 변수 설정 (중요!)
"Environment Variables" 섹션에 아래 3개 추가:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...your_anon_key...` |
| `NEXT_PUBLIC_ADMIN_SECRET` | `원하는_관리자_코드` (예: `admin123`) |

### 3-3. 배포
"Deploy" 클릭 → 2-3분 대기 → 배포 완료!

배포된 URL: `https://workshop-platform-xxx.vercel.app`

---

## Step 4: 관리자 계정 설정

1. 배포된 URL 접속
2. `/login` 페이지에서 "회원가입" 탭 선택
3. 이름, 이메일, 비밀번호 입력
4. **관리자 코드** 입력 (Step 3-2에서 설정한 `NEXT_PUBLIC_ADMIN_SECRET`)
5. 회원가입 완료 → 자동으로 관리자 패널로 이동

---

## Step 5: 워크샵 운영 가이드

### 📌 게임 진행 순서

#### 퀴즈 게임
```json
{
  "timeLimit": 30,
  "scorePerQuestion": 100,
  "questions": [
    {
      "text": "대한민국의 수도는?",
      "options": ["서울", "부산", "대구", "인천"],
      "answer": 0,
      "score": 100
    },
    {
      "text": "2 + 2 = ?",
      "options": ["3", "4", "5", "6"],
      "answer": 1,
      "score": 50
    }
  ]
}
```

#### 미션 게임
```json
{
  "scorePerMission": 50,
  "missionList": [
    { "title": "팀 구호 만들기", "description": "팀 구호를 만들고 발표하세요", "score": 100 },
    { "title": "단체 사진 찍기", "description": "팀 전원이 나오는 사진을 찍으세요", "score": 50 },
    { "title": "아이스브레이킹", "description": "팀원 이름을 모두 외우세요", "score": 80 }
  ]
}
```

#### 투표 게임
```json
{
  "question": "오늘 점심 메뉴는?",
  "options": ["한식", "중식", "일식", "양식"]
}
```

#### 타이머 게임
```json
{
  "duration": 600,
  "rules": "제한시간 10분 안에 미션을 완료하세요!\n1. 팀 이름 정하기\n2. 팀 구호 만들기\n3. 팀 대표 선출",
  "scoreOnComplete": 200
}
```

---

### 🎮 관리자 운영 절차

1. **게임 추가**: 관리자 패널 → 게임 탭 → "+ 게임 추가"
2. **팀 구성**: 팀 탭 → 팀 생성 → "무작위 배정" 또는 수동 배정
3. **게임 시작**: 게임 탭 → 게임 선택 → "▶ 시작"
4. **실시간 모니터링**: 참가자 탭에서 온라인 현황 확인
5. **점수 조정**: 점수 탭 → 수동 추가/차감
6. **공지 발송**: 공지 탭 → 제목/내용 입력 → "공지 발송"
7. **게임 종료**: 게임 탭 → "■ 종료"

### 🗺️ 보물찾기 운영 절차

1. 관리자 패널 → 게임 탭 → 보물찾기 게임 추가
2. 게임 클릭 → "🗺️ 보물 편집" 버튼
3. 지도 클릭 → 보물 위치 설정
4. 힌트, 점수, 노출/획득 반경 설정 → 저장
5. 게임 시작 후 참가자들이 현장에서 탐색

---

## 🔧 트러블슈팅

### 지도가 안 보이는 경우
- 브라우저 콘솔에서 오류 확인
- `leaflet.css`가 로드되었는지 확인 (`globals.css`의 `@import` 라인)

### 실시간 업데이트가 안 되는 경우
- Supabase Dashboard → Database → Replication에서 테이블 Realtime 활성화 확인
- 브라우저 네트워크 탭에서 WebSocket 연결 확인

### 위치 서비스가 안 되는 경우
- **HTTPS** 환경에서만 GPS가 작동합니다 (localhost 제외)
- 브라우저에서 위치 권한 허용 필요
- Vercel 배포 후에는 정상 작동

### 로그인이 안 되는 경우
- Supabase → Authentication → Settings → "Confirm email" 비활성화 (개발 편의를 위해)
- 또는 Supabase → Authentication → Users에서 이메일 수동 확인

---

## 📁 파일 구조

```
workshop-platform/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 루트 레이아웃
│   │   ├── globals.css             # 전역 스타일
│   │   ├── page.tsx                # 참가자 홈
│   │   ├── login/page.tsx          # 로그인/회원가입
│   │   ├── leaderboard/page.tsx    # 랭킹
│   │   ├── team/page.tsx           # 팀 현황
│   │   ├── profile/page.tsx        # 내 정보
│   │   ├── admin/
│   │   │   ├── page.tsx            # 어드민 패널
│   │   │   └── treasure/[id]/      # 보물 편집기
│   │   └── games/
│   │       ├── quiz/[id]/          # 퀴즈 게임
│   │       ├── mission/[id]/       # 미션 게임
│   │       ├── timer/[id]/         # 타이머 게임
│   │       ├── voting/[id]/        # 투표 게임
│   │       └── treasure/[id]/      # 보물찾기
│   ├── components/
│   │   ├── BottomNav.tsx           # 하단 네비게이션
│   │   ├── AnnouncementBanner.tsx  # 공지 배너/모달
│   │   ├── GameCard.tsx            # 게임 카드
│   │   ├── TreasureMap.tsx         # Leaflet 지도
│   │   └── admin/
│   │       ├── AdminGames.tsx      # 게임 관리
│   │       ├── AdminTeams.tsx      # 팀 관리
│   │       ├── AdminScores.tsx     # 점수 관리
│   │       ├── AdminAnnouncements.tsx  # 공지 관리
│   │       └── AdminParticipants.tsx   # 참가자 관리
│   ├── contexts/
│   │   └── AuthContext.tsx         # 인증 컨텍스트
│   └── lib/
│       ├── supabase.ts             # Supabase 클라이언트
│       └── distance.ts             # Haversine 거리 계산
├── supabase/
│   └── schema.sql                  # 전체 DB 스키마
├── public/
│   └── manifest.json               # PWA 설정
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── vercel.json
```

---

## 🔒 보안 주의사항

1. `.env.local` 파일은 절대 GitHub에 커밋하지 마세요
2. `NEXT_PUBLIC_ADMIN_SECRET`은 워크샵마다 변경하세요
3. Supabase RLS(Row Level Security)가 활성화되어 있어 데이터가 보호됩니다
4. 관리자 코드를 잃어버린 경우 Supabase SQL Editor에서:
   ```sql
   UPDATE users SET role = 'admin' WHERE name = '이름';
   ```

---

## 🆕 커스터마이징

### 새 게임 타입 추가
1. `supabase/schema.sql`의 `games.type` CHECK 제약 수정
2. `src/app/games/[새타입]/[id]/page.tsx` 생성
3. `src/app/page.tsx`의 `gameTypeLabel` 객체에 추가
4. `src/components/GameCard.tsx`에 아이콘 추가

### 디자인 커스터마이징
- `src/app/globals.css`의 CSS 변수 수정
- `tailwind.config.js`의 컬러 팔레트 변경

---

문의사항이나 오류 발생 시 GitHub Issues를 활용하세요.
