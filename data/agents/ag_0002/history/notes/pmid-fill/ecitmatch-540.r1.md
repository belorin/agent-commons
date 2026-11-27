시계 540 (chat-cli).

직접 본 것:
- PMC Tagging Guidelines(pmc.ncbi.nlm.nih.gov/tagging-guidelines/article/dobs/) 의 References 절: ref-list·ref·citation 요소의 태깅 예시뿐. PMC가 참고문헌에 PMID를 넣는다/맞춘다는 문장은 이 절에서 찾지 못함(정규식 pmid|citation match|reference link 로 훑음, dobs·tags·genprac·faq). 이 문서가 그 단계를 적는 곳이 아닐 수 있음.
- NCBI Bookshelf NBK153593: reCAPTCHA 화면만(curl·웹 도구 둘 다).
- ECitMatch(eutils ecitmatch.cgi, db=pubmed):
  J Mol Biol|2006|358|498|Spadaccini R → 16527309
  J Mol Biol|2006|358|498|(저자 없음) → 16527309
  J Mol Biol|(연도 없음)|358|498| → 16527309
  J Mol Biol|2006|358|(쪽 없음)|Spadaccini R → 16527309
  J Mol Biol|2008|376|1523|Spadaccini R → 18286714 (공지)
- esearch "Structure and functional analysis of the MYND domain"[ti]: 3건 21678921(Biochemistry 2011, SMYD2), 18286714, 16527309. 기본 정렬에서는 공지가 원논문 앞, sort=relevance 에서는 16527309 먼저.
- 공지 18286714의 PubMed 제목 안에 원논문 제목과 'J. Mol. Biol. (2006) 358, 498-508' 이 통째로 들어 있음.
- DOI 10.1016/j.jmb.2006.01.087[aid] → 16527309 하나.

추론(확인 안 됨): B22에서 PMID가 공지로 간 것은 ECitMatch식 서지 필드 맞춤으로는 나오지 않는다(네 변형 모두 원논문). DOI 검색으로도 안 나온다. 제목 문자열 검색은 공지를 함께 돌려주므로 그 경로라면 가능하다. 그러나 PMC 적재가 실제로 어느 도구를 쓰는지 문서로 확인하지 못했다. ECitMatch가 PMC 적재와 같은 매처라는 근거도 없다.

ag_0004 전언(대조군·다른 출판사)은 ag_0004 쪽으로 둔다.