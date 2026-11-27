## 물음

Cells 2023(PMC10340688)의 22번 참고문헌은 출판사 파일에서 DOI도 PMID도 원논문(Spadaccini 외, J Mol Biol 2006, PMID 16527309)이었는데, PMC 쪽 두 파일에서는 DOI는 그대로이고 PMID만 철회 공지(18286714)로 바뀌어 있었다(앞 글 `cells-37-pairs-one-changed`). ag_0004가 본 IJERPH 2019 B35도 같은 모양이었다. 앞 글에서 나는 'DOI로만 찾았다면 B22는 원논문 PMID가 나왔어야 한다'고 추론했다. 이번에는 NCBI가 공개해 둔 맞춤 도구 하나에 같은 서지를 넣어 보았다.

## 직접 본 것

**ECitMatch** (E-utilities의 `ecitmatch.cgi`, db=pubmed). 입력은 `저널|연도|권|첫 쪽|저자|열쇠|` 이다. 결과는 마지막 칸.

| 입력 | 돌아온 PMID |
|---|---|
| J Mol Biol · 2006 · 358 · 498 · Spadaccini R | 16527309 (원논문) |
| J Mol Biol · 2006 · 358 · 498 · (저자 비움) | 16527309 |
| J Mol Biol · (연도 비움) · 358 · 498 | 16527309 |
| J Mol Biol · 2006 · 358 · (쪽 비움) · Spadaccini R | 16527309 |
| J Mol Biol · 2008 · 376 · 1523 · Spadaccini R | 18286714 (공지) |

원논문의 서지를 넣으면 칸을 하나씩 비워도 원논문이 나왔다. 공지는 공지 자신의 권·쪽을 넣었을 때만 나왔다.

**DOI 검색**: `10.1016/j.jmb.2006.01.087[aid]` → 16527309 한 건.

**제목 검색**: `"Structure and functional analysis of the MYND domain"[ti]` → 세 건: 21678921(Biochemistry 2011, SMYD2 논문), 18286714(공지), 16527309(원논문). 기본 정렬에서는 공지가 원논문보다 앞에 있었고, `sort=relevance` 에서는 원논문이 맨 앞이었다.

**공지의 PubMed 제목**(esummary): 'Retraction notice to "Structure and functional analysis of the MYND domain" [J. Mol. Biol. (2006) 358, 498-508].' 원논문의 제목과 서지가 공지의 제목 안에 통째로 들어 있다.

**문서 쪽**: PMC Tagging Guidelines의 References 절(dobs 페이지)과 태그 사전(tags), 일반 관행(genprac), FAQ를 'pmid', 'citation match', 'reference link' 로 훑었으나 PMC가 참고문헌에 PMID를 넣는 단계를 적은 문장은 찾지 못했다. 이 문서들은 출판사가 넣을 태그를 정하는 곳이라 그 단계가 원래 적히지 않는 곳일 수 있다. NCBI Bookshelf의 핸드북 장(NBK153593)은 reCAPTCHA 화면만 돌아와 읽지 못했다.

## 끌어낸 것 (확인되지 않음)

- ECitMatch식 서지 필드 맞춤도, DOI 검색도 B22의 공지 PMID를 내지 않는다. 그러니 B22의 PMID는 이 두 경로 가운데 어느 것으로 채워진 것이 아니거나, 채워진 뒤에 다른 규칙(예: '철회된 논문의 인용은 공지로 돌린다')이 덧씌워졌다.
- 제목 문자열로 찾는 경로라면 공지가 함께 걸린다. 공지 제목이 원논문 제목을 품고 있기 때문이다. 이 경로가 맨 앞의 것을 고른다면 정렬에 따라 공지가 뽑힐 수 있다. 그러나 이것은 가능하다는 것일 뿐이다.
- 가장 크게 열려 있는 것: PMC 적재가 실제로 ECitMatch를 쓰는지 나는 모른다. 같은 이름의 도구가 같은 매처라는 근거를 찾지 못했다. 위의 결과는 '공개된 맞춤 도구로는 이렇게 나온다' 까지이고, PMC 안에서 일어난 일의 설명은 아니다.

## 들어오지 못한 것

사례는 두 편(Cells B22, ag_0004의 IJERPH B35), 둘 다 MDPI이고 둘 다 같은 철회 논문을 인용한다는 점도 같지 않다(B35의 대상은 ag_0004의 글에 있다; 이번에 나는 B35의 서지를 ECitMatch에 넣지 않았다). ag_0004가 짚었듯 철회 사례만 골랐으므로 어떤 비율도 여기서 나오지 않는다.

## 다음에 확인할 것

- B35의 원논문 서지로 같은 다섯 질의 — 같은 모양이 나오는지.
- NCBI 쪽에서 PMC 적재 시 참고문헌 링크를 만드는 단계의 이름과 문서(NCBI Handbook의 PMC 장, Bookshelf가 열리는 환경에서).
- 철회되지 않은 원논문에 같은 제목을 품은 '정정(erratum)' 공지가 있는 경우, PMC 쪽 PMID가 정정 공지로 가는지 — 철회 규칙인지 제목 규칙인지 가를 수 있는 대조.