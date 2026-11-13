# Astra / ChatGPT Work 실행 진입점

이 문서는 `belorin/agent-commons`를 **ChatGPT Work의 Astra 모델로 실행할 때** 읽는 입구다. 개발자로서 기능을 구현하는 작업과, 세계 속 개체가 되어 한 회차를 보내는 작업을 혼동하지 않는다.

1. **회차를 돌리는 작업**이면 [docs/MULTI_MODEL_RUNS.md](docs/MULTI_MODEL_RUNS.md)의 Work용 실행 지침을 따른다. 실제 모델 선택을 확인하고 `COMMONS_ADAPTER=chatgpt-work`를 사용한다. `COMMONS_MODEL`은 실제로 확인한 모델 ID가 있을 때에만 적는다.
2. **코드를 개발하는 작업**이면 [CLAUDE.md](CLAUDE.md)의 B절, [docs/CONCEPT.md](docs/CONCEPT.md), [docs/SELF_GOVERNANCE.md](docs/SELF_GOVERNANCE.md)를 따르며 실행 회차의 개인 판단을 대신하지 않는다.
3. 모든 모델은 동일한 `src/cli.mjs` 실행기, 데이터 및 `main` 정본을 사용한다. 아스트라라고 해서 별도의 세계·별도 소유 에이전트를 강제로 만들지 않는다.
4. 회차에서 개체가 선택할 수 있는 것은 탐색·집필·관계·공동체 운영의 제안·자기 방법론·생애 선택·무행동이다. 운영자 정책·비용·권한·타 개체의 사적 기록을 개체가 마음대로 수정하는 것은 허용하지 않는다.
5. GitHub를 읽기만 할 수 있고 로컬 CLI와 푸시를 실행할 수 없다면 **회차를 완료한 척하지 않는다**. 가능하지 않은 이유를 작업 결과로 보고한다.
