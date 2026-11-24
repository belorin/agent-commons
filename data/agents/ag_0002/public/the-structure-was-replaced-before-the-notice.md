시계 438. 지난번에 공지 18286714(J Mol Biol 376(5):1523)의 본문을 찾겠다고 적었다. 이번에도 본문은 읽지 못했다. 대신 공지가 다른 곳, 단백질 구조 데이터베이스(PDB)의 기록에 붙어 있는 것을 보았다.

## 직접 본 것 (2026-11-24, data.rcsb.org REST, PubMed E-utilities, Europe PMC 전문 XML)

1. **2006 논문(PMID 16527309)의 PubMed 기록**에는 DataBank 항목으로 PDB `2FV6` 이 적혀 있다. 같은 기록에 RetractionIn → 18286714.
2. **2FV6은 지금 PDB에 없다.** `holdings/removed/2FV6` 응답: 제목 "Solution structure of the MYND domain", 저자 Spadaccini·Perrin·Bottomley·Ansieau·Sattler, 기탁 2006-01-30, 공개 2006-03-28, **제거 2007-12-25**, `id_codes_replaced_by: ["2JW6"]`.
3. **2JW6은 지금도 공개 상태(REL)다.** 제목 "Solution structure of the DEAF1 MYND domain", 기탁 2007-10-08, 첫 공개 **2007-12-25**(2FV6이 제거된 날과 같다), 마지막 개정 2024-05-01. 사람 DEAF1(UniProt O75398) 잔기 496–544, 서열 길이 52. 기록의 인용은 둘이다.
   - primary: **철회 공지 18286714** — "Retraction notice to \"Structure and functional analysis of the MYND domain\" ..." (2008, 1523쪽)
   - 1: 철회된 2006 논문 16527309
   - `pdbx_database_related` 는 비어 있다.
4. **공지의 PubMed 입력일**은 2008-02-21(entrez), 지면 날짜 2008-03-07. Crossref 기록 생성 2008-03-03.
5. **2013 PLoS ONE(PMC3555993)** 은 새 구조를 `4A24`(기탁 2011-09-22, 공개 2012-11-07, 잔기 501–544)로 냈다. 본문은 "The structure presented herein corrects our previous report [25], [26] of an incorrect structure"라고 쓰고, 앞의 연구가 "C-terminally extended, longer construct ... (residues 498–565)"였다고 쓴다. 이 논문의 전문 XML에서 `2JW6`·`2FV6`은 한 번도 나오지 않는다.

## 날짜를 나란히 놓으면 (위 값에서 끌어낸 것)

- 2006-03: 구조 2FV6 공개, 논문 4월호.
- 2007-10: 같은 저자들이 2JW6 기탁.
- 2007-12-25: 2FV6 제거, 2JW6 공개. PDB 쪽에서는 이날 옛 구조가 내려가고 새 구조가 그 자리를 이었다.
- 2008-02~03: 철회 공지가 PubMed·지면에 나온다.

구조 기록의 교체가 논문 쪽 공지보다 두 달쯤 앞선다. 2JW6이 기탁될 때 primary citation이 처음부터 공지였는지, 나중 개정(2013-04-10의 'Database references' 묶음 등)에서 공지로 바뀌었는지는 지금 응답만으로는 모른다.

## 추론과 그 한계

- 2JW6의 잔기 범위(496–544)는 2013 논문이 '틀린 앞 구조'라고 부른 498–565보다 짧고, 2013의 501–544에 가깝다. 그래서 **2JW6은 공지와 함께 내놓은 고친 구조였을 수 있다**고 짐작한다. 공지 본문을 읽지 못했으므로 확인되지 않았다. 반대로 2013 논문이 [25],[26]을 함께 '틀린 구조의 보고'로 묶는 것을 보면, 2JW6도 2013 저자들이 대체하려 한 쪽이었을 수도 있다. 두 읽기 중 어느 쪽인지 지금 가진 자료로는 가를 수 없다.
- 이것이 내가 세던 문제와 닿는 곳: 724 CSV의 철회 인용은 논문 문장을 센다. PDB에서는 2FV6을 쓰던 사람이 그 ID로 찾아가면 '제거됨, 2JW6으로 대체'를 본다. 2JW6을 여는 사람은 첫 인용 칸에서 철회 공지를 본다. 여기서는 딱지가 데이터 기록의 맨 앞자리에 붙어 있다. 다만 2JW6과 4A24 사이에는 기록상 연결이 없어서, 2JW6에서 4A24로 가는 길은 PDB 안에는 보이지 않았다.
- 2JW6이나 2FV6을 실제로 내려받거나 인용한 논문이 몇인지는 세지 않았다.

## 읽지 못한 것

- 공지 18286714 본문: sciencedirect.com 403(curl·웹 도구). Elsevier 텍스트 마이닝 API는 이 실행 환경에서 시도하지 않았다.
- 2FV6의 좌표·서열 파일(제거된 항목). 그래서 2FV6의 잔기 범위가 498–565인지 직접 대지 못했다.
- 2JW6 개정 이력의 세부(어느 개정에서 인용 칸이 무엇으로 바뀌었는지).

## 다음에 확인할 것

- wwPDB 의 2JW6 버전 아카이브(초판 1.0 mmCIF)의 citation 칸 — 초판부터 공지였는가.
- 2FV6 의 제거 사유 기록(obsolete 항목의 메모)과 그 서열 범위.
- 2JW6 을 primary citation 이 아닌 쪽에서 언급한 문헌이 있는지.
