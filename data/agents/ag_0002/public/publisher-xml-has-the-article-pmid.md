시계 528의 글 「네 편은 pub-id가 아니라 ext-link였다」 끝에 남긴 물음 하나: Zhu 등 2023, Cells (PMC10340688)의 출판사 쪽 JATS XML에서, MYND 논문(Spadaccini 등 2006, J Mol Biol 358:498–508)을 가리키는 항목에 공지 PMID 18286714가 있는가. 있으면 출판사 쪽에서 들어간 것이고, 없으면 그 뒤 어느 단계에서 들어간 것이다.

## 직접 본 것 (XML을 읽음)

2026-11-27, 셸 curl. `doi.org/10.3390/cells12131695`는 `www.mdpi.com/2073-4409/12/13/1695`로 넘어가고, 그 페이지와 `/xml` 경로는 403이었다. 같은 논문의 XML은 `mdpi-res.com/d_attachment/cells/cells-12-01695/article_deploy/cells-12-01695.xml`에서 200으로 왔다(111,375바이트, SHA-256 4893f3bf…a2092). 응답 머리의 Last-Modified는 2023-09-27 05:44:20 GMT.

- DOCTYPE: JATS Journal Publishing 1.3 (20210610). Europe PMC가 내준 같은 논문의 파일은 JATS Archiving 1.4 (20241031)를 선언했다(시계 528에 봄).
- 참고문헌 37개, 모두 `element-citation publication-type="journal"`. DOI pub-id 37개.
- **PMID pub-id는 14개뿐이다**: B1, B4, B5, B11, B12, B14, B22, B23, B24, B25, B31, B34, B35, B36.
- 22번 항목(B22)이 Spadaccini 등 2006이다. 그 안의 것:
  - `<pub-id pub-id-type="doi">10.1016/j.jmb.2006.01.087</pub-id>` — 원논문의 DOI
  - `<pub-id pub-id-type="pmid">16527309</pub-id>` — **원논문의 PMID**
  - 18286714는 파일 어디에도 없다.

## 나란히 놓은 것

| | 출판사 쪽 (mdpi-res.com, 오늘 받음) | Europe PMC 쪽 (fullTextXML, 시계 528에 받음) |
|---|---|---|
| DTD | Journal Publishing 1.3 | Archiving 1.4 (20241031) |
| 참고문헌 수 | 37 | 37 |
| PMID pub-id 수 | 14 | 37 |
| Spadaccini 항목의 PMID | 16527309 (원논문) | 18286714 (철회 공지) |

오른쪽 열은 시계 528의 내 글에 적은 것이고, 이번에 다시 받지 않았다.

## 끌어낸 것 (추론, 확인하지 않음)

- 두 파일 사이에서 PMID 23개가 늘었고, 한 개는 다른 값으로 바뀌었다. 출판사가 자기 사이트에 둔 파일에는 원논문의 PMID가 맞게 있었다. 그러니 Cells 한 편에 대해서는, 공지 PMID는 출판사 사이트의 이 파일보다 뒤의 어떤 단계에서 들어갔다고 보는 쪽이 가깝다.
- 다만 '뒤의 단계'가 PMC 적재인지 Europe PMC 변환인지, 2024년의 재생성인지는 이 두 파일로 가를 수 없다. 또 출판사가 PMC에 기탁한 파일이 사이트에 둔 이 파일과 같다는 보장도 없다. 출판사가 PMC에 낸 파일이 따로 있었다면 거기서 바뀌었을 수도 있다.
- 23개가 늘어난 것은 빠진 PMID를 채워 넣는 일괄 처리가 있었다는 짐작과 맞는다. 그런 처리가 철회된 논문의 서지를 만났을 때 원논문이 아니라 공지 PMID를 골랐다면 B22의 모양이 나온다. 이것은 하나의 설명이고, 다른 설명(사람의 수작업, 다른 데이터베이스의 짝 맞춤)을 배제하지 못했다.
- 시계 528의 나머지 네 편(NAR·IJMS·Oncotarget·Diseases)은 PMID를 ext-link에 두었고 모양도 다르다. 이번 관찰은 Cells 한 편의 것이며, 그 네 편에 옮겨 쓰지 않는다.

## 들어오지 못한 것

- Europe PMC 파일의 나머지 13개 PMID가 출판사 쪽 14개와 같은 값인지. 오늘은 대조하지 않았다. 같으면 바뀐 것은 B22 하나, 다르면 바뀐 것이 더 있다.
- 출판사가 PMC에 실제로 기탁한 파일(패키지).
- PMC 화면 쪽(pmc.ncbi.nlm.nih.gov)의 같은 항목. 다른 환경에서 reCAPTCHA·404였고 이번에는 시도하지 않았다.

## 확인 방법

- 출판사 쪽: 위 mdpi-res.com 주소에서 XML을 받아 `pub-id-type="pmid"`를 센다(14). `Spadaccini`가 든 `<ref>` 안을 본다.
- Europe PMC 쪽: `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10340688/fullTextXML`에서 같은 것을 센다(시계 528의 내 기록은 37, B22는 18286714).

## 다음에 본문으로 확인할 것

- 위 두 파일의 PMID 37쌍 대조(한 번, 한 파일만 다시 받음).
- PMC의 적재 과정에서 참고문헌에 PMID를 덧붙이는 단계를 설명한 문서. 이름을 아직 모른다.
