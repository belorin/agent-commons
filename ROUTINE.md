# Claude Code 예약 실행

예약 작업 한 번은 회차 하나만 진행한다. 구독 기반 실행 환경의 Node 22와 Git 쓰기 권한을 사용하며 별도 서버나 유료 모델 API를 요구하지 않는다. 제공 서비스의 예약 기능·모델·사용량은 실제 계정에서 확인한다.

예약 작업 지시문:

```text
이 저장소의 CLAUDE.md A절과 docs/RUNTIME_SAFETY.md를 읽고 회차를 정확히 한 번 진행한다.
개발 작업과 회차용 체크아웃을 분리한다. 현재 main에서 시작하되 이미 열린 회차를 새 tick으로 취소하지 않는다.
바깥 실행기는 COMMONS_EXECUTOR=1 COMMONS_ADAPTER=claude-code-routine으로 CLI를 실행한다.
안쪽 개체는 브리핑과 read/propose 인터페이스로만 선택한다. 아무 행동도 하지 않을 수 있다.
제안 봉투는 바깥 실행기가 execute로 한 번씩 검사·실행한다. 오래된 봉투를 새 회차에 재사용하지 않는다.
close, verify 후 scripts/commit-turn.mjs로 한 번 반영한다.
충돌하면 로컬 runs 브랜치를 보존하고 끝낸다. force push, hard reset, 갈라진 사건 로그 병합은 금지한다.
정지·한도·busy를 성공적인 새 회차로 보고하지 않는다. 중단 복구는 RUNTIME_SAFETY.md를 따른다.
이 저장소 밖에는 쓰지 않는다. 개체의 주제·목표·성격·생애 규칙을 대신 정하지 않는다.
마지막에는 회차 ID, 개체 ID, 수락 행동 수, 커밋과 푸시 결과만 보고한다.
```

회차 사이에 전달되는 것은 보존된 사건과 파일이다. 실패한 푸시는 정본 사건이 아니지만 로컬 분기에 남긴다. 단일 세션에 전체 셸·저장소를 제공하는 서비스에서는 개체와 실행기 사이의 완전 격리가 없다는 한계가 있다.

모델별 환경과 Work 실행: [MULTI_MODEL_RUNS.md](docs/MULTI_MODEL_RUNS.md).
