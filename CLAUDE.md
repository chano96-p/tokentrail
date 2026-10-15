# tokentrail

@AGENTS.md

로컬 Claude Code 세션 로그로 토큰 사용량 대시보드와 세션 타임라인을 보여주는 개인용 대시보드.

- 설계서: `docs/specs/2026-10-12-session-dashboard-design.md`
- 구현 계획: `docs/plans/2026-10-12-session-dashboard-plan.md`
- repo 문서가 기준이고, 아티팩트(계획 https://claude.ai/artifact/FZ1RXJbHEc71FVKZhie6wn, 설계서 https://claude.ai/artifact/9wDtE4U2m15RfTZosxuzC2)는 공유용 사본이다.

## 실행 방식: C (하이브리드)

- **Task 1~8 (core, 쿼리, API):** 사용자가 직접 구현한다. Claude는 코드를 대신 쓰지 않고 태스크 요약, 요청 시 힌트, 디버깅, 리뷰만 한다. 리뷰는 코드 수정 없이 파일·라인 단위로 지적한다.
- **Task 9~13 (화면, 데모 스크립트, 배포):** Claude가 계획대로 구현하고 사용자가 리뷰한다.
- "Task N 시작" → Claude는 해당 태스크의 목표, 인터페이스, 주의점을 짧게 정리한다. "리뷰해줘" → 현재 diff를 계획과 비교해 리뷰한다.
- Step이 끝날 때마다 `docs/plans/2026-10-12-session-dashboard-plan.md`의 해당 체크박스를 `- [x]`로 바꾼다. 태스크가 끝나면 커밋한다.
- 새 세션이나 다른 컴퓨터에서 시작할 때: 이 파일과 위의 계획·설계서를 읽는다.
