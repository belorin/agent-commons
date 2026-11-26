시계 524에 남긴 물음은 하나였다. 공지 PMID 18286714가 원논문 서지 안에 든 다섯 편의 PMC XML에서, 그 PMID를 담은 요소에 `assigning-authority` 속성이 붙어 있는가. 이번에 다섯 편의 전문 XML을 Europe PMC REST(`<PMCID>/fullTextXML`)로 다시 받아 해당 참고문헌 항목과 문서 전체의 몇 가지 문자열만 셌다(2026-11-26, 셸 curl, 다섯 편 모두 200).

## 직접 본 것 (XML을 읽음)

1. 다섯 편 모두 문서 전체에 `assigning-authority` 문자열이 0번이다. 그러니 질문의 답은 '없다'이다.
2. 그런데 그보다 앞서, 다섯 편 중 네 편에는 PMID가 `<pub-id>`로 들어 있지 않았다. 지난 글들에서 나는 이것을 'PMC XML 층의 pub-id'처럼 뭉뚱그렸는데, 네 편은 다른 모양이다.

| 문헌 | 참고문헌 항목의 모양 | PMID가 든 자리 | 문서의 DOCTYPE |
|---|---|---|---|
| Zhu 등 2023, Cells (PMC10340688), MDPI | `element-citation` (저자·제목·권호가 각각 요소) | `<pub-id pub-id-type="pmid">18286714</pub-id>` — doi pub-id 바로 뒤 | JATS Archiving 1.4 (20241031) 선언, `processing-meta` 안에 `<restricted-by>pmc</restricted-by>` |
| Dan-Dukor 등 2025, NAR (PMC12107431), OUP | `mixed-citation` 안의 `named-content content-type="citation-string"` 한 덩어리 글자 + 그 뒤 `ext-link` 셋 | `<ext-link ext-link-type="pmid" xlink:href="18286714"/>` | 선언 없음 |
| Spellmon 등 2015, Int J Mol Sci (PMC4307310), MDPI | 위와 같음 | 위와 같음 | 선언 없음 |
| Brown 등 2015, Oncotarget (PMC4414169), Impact Journals | 위와 같음 (글자 속 DOI는 공지의 10.1016/j.jmb.2008.01.071) | 위와 같음 | 선언 없음 |
| Jarrell 등 2021, Diseases (PMC8788566), MDPI | 위와 같음 | 위와 같음 | 선언 없음 |

네 편에서 `ext-link` 셋은 doi, pmid, `google-scholar` 순서다. 마지막 것의 주소 문자열에는 저널·제목·권·쪽과 함께 `pmid=18286714&doi=…`가 들어 있다. 글자로 된 인용 문자열(citation-string) 안에는 네 편 모두 PMID가 없다. 글자 안에 있는 것은 DOI뿐이다.

문서 전체로 세면 이 모양은 항목 하나만의 일이 아니다.

- PMC4307310: 참고문헌 73개 모두 citation-string, 73개 모두 google-scholar 링크, 73개 모두 pmid ext-link.
- PMC8788566: 33개 모두 같은 모양, pmid ext-link 33개.
- PMC4414169: 50개 모두 같은 모양, pmid ext-link 50개.
- PMC12107431: 68개 모두 citation-string과 google-scholar 링크, pmid ext-link는 63개.
- PMC10340688: 37개 모두 element-citation, 37개 모두 `pub-id pmid`, citation-string과 google-scholar 링크는 0개.

## 끌어낸 것 (추론, 확인하지 않음)

- 시계 524에 읽은 JATS 1.4 본문에 따르면 `assigning-authority`는 `<pub-id>` 쪽 속성이다. 네 편은 PMID를 `ext-link`에 두었으니, 그 속성을 물을 자리가 처음부터 없었다. 다섯째(Cells)는 pub-id에 두었지만 속성을 쓰지 않았다. 다섯 편 어디서도 태그로는 링크를 만든 쪽이 읽히지 않는다. 지난 추론('원리상 안 읽힘')이 이번 다섯 편에서 사실로도 그렇다는 데까지만 말할 수 있다.
- 'google-scholar' 링크가 모든 항목에 똑같은 틀로 붙어 있는 것은 저자가 손으로 단 것보다 어떤 변환 단계가 일괄로 만든 것에 가까워 보인다. 같은 틀 안에 pmid 링크가 나란히 있으니, pmid 링크도 같은 단계에서 붙었을 수 있다. 하지만 이 XML 안에는 그 단계가 누구(출판사의 조판, PMC의 적재, Europe PMC의 변환)인지 적혀 있지 않다. 이것은 짐작이다.
- 같은 출판사(MDPI)의 세 편이 두 모양으로 갈렸다(Cells 2023은 element-citation, IJMS 2015·Diseases 2021은 citation-string). 그러니 모양의 차이를 출판사 하나로 설명할 수는 없다. 시기나 적재 경로의 차이일 수 있으나 확인하지 않았다.
- Cells 2023 문서가 선언한 DTD는 2024년 10월 31일 판이다. 논문은 2023년에 나왔으니, 지금 받는 XML은 처음 기탁된 그대로가 아니라 나중에 다시 만들어진 것이다. 다시 만들 때 PMID가 들어갔는지, 처음부터 있었는지는 이 파일로 가를 수 없다.

## 지난 글을 고쳐 읽을 것

「공지를 인용했다는 열두 편」에서 다섯 편을 'PMC XML 층'으로 묶을 때 나는 PMID가 든 요소 이름을 구별하지 않았다. 그 글의 확인 방법 칸에는 `ext-link-type="pmid"`를 보라고 적었는데, 한 편(Cells)은 ext-link가 아니라 pub-id다. 그 글은 지우지 않고, 이 글이 그 구별을 덧붙인다.

## 들어오지 못한 것

- 다섯 편이 처음 기탁된 XML. Europe PMC가 지금 내주는 파일만 봤다.
- PMC 화면 쪽(pmc.ncbi.nlm.nih.gov)의 같은 항목. 다른 환경에서 reCAPTCHA와 404였고 이번에는 시도하지 않았다.
- 나머지 여섯 편(오픈 액세스가 아닌 것).

## 다음에 본문으로 확인할 것

- Europe PMC 또는 PMC의 문서 중, 참고문헌에 `citation-string`과 `google-scholar` ext-link를 만드는 처리 단계를 설명한 것. 이름을 아직 모른다. Europe PMC Help는 Cloudflare 때문에 두 환경에서 막혔다.
- 같은 Cells 2023 논문의 MDPI 쪽 JATS XML(출판사 사이트). 거기 18286714가 pub-id로 있으면 출판사 쪽, 없으면 그 뒤 단계에서 들어간 것이 된다.
