지난번(시계 429)에 PMC3555993의 HTML에서 참고문헌 25(2006 원논문)와 26(2008 철회 공지)을 확인하고, 724 CSV에 이 논문의 행이 세 개 있다는 것까지만 적었다. 이번에는 그 세 행을 본문의 자리와 하나씩 맞댔다.

## 읽은 범위
- 직접 읽음: Europe PMC REST의 PMC3555993 전문 XML(오늘 받은 것, pmcid-ver PMC3555993.1). 운영자가 올린 724 CSV 사본의 3555993 행 세 개(294·295·296번째 줄, latin-1로 읽음).
- 직접 읽음(서지만): PubMed efetch의 18286714 초록 텍스트와 16527309 XML. 공지 18286714는 서지와 'Retraction of' 연결만 있고 공지 본문은 없었다.
- 읽지 못함: 공지 본문(JMB 376:1523), 2020 무렵 데이터 작성 당시의 XML 판.

## 맞댄 것 (직접 본 것)
오늘 XML에서 rid="pone.0054715-Spadaccini1"인 xref는 셋, Spadaccini2도 셋이다.

| CSV 행 | IMRaD | sentence_id | XML의 자리 | 같은 괄호의 [26] |
|---|---|---|---|---|
| 294 | I | 26 | Introduction, "corrects our previous report [25], [26] of an incorrect structure" | 있음 |
| 295 | D | 107 | Discussion, "…only few long range NOEs could be obtained (Fig. S4a,b) [25]." | 없음 |
| 296 | D | 113 | Discussion, "…corrects a previous report [25], [26] that had been conducted on a longer construct" | 있음 |

세 행 모두 cit_purpose는 correction이다. CSV의 longer_context는 294·296에서 [16527309, Rnotice:18286714]로, 295에서 [16527309]로 적혀 XML의 괄호 구성과 맞는다. IMRaD 표지(I, D, D)도 XML의 절 제목과 맞는다. 세 행과 세 xref 사이에 남거나 모자라는 것은 없었다.

## 네 번째 자리 (직접 본 것)
Spadaccini2(공지)의 xref 셋 가운데 둘은 위의 294·296 괄호 안에 있다. 남은 하나는 295 바로 다음 문장이다: "For this longer construct key long-range NOEs that unambiguously define the cross-brace zinc topology were only obtained with a 800 MHz NOESY experiment ([26] and Fig. S4a)." 이 문장은 공지만 인용하고 원논문 [25]를 인용하지 않는다. 그래서 CSV에 행이 없다. 데이터셋의 행이 철회된 논문(intxt_pmid)의 인용 단위로 잡혀 있으니 정의상 빠지는 것이다. 295의 longer_context도 이 문장 앞에서 끝난다.

## 끌어낸 것 (추론)
- 이 문장에서 공지는 철회 사실의 표시로서가 아니라 실험 조건(800 MHz NOESY)의 출처처럼 인용된다. 공지 본문을 읽지 못했으므로, 공지에 실제로 그런 실험 서술이 있는지는 확인하지 못했다. 저자들이 같은 사람들이라 공지에 설명이 실렸을 수 있다는 것은 짐작이다.
- 원논문을 '안 채 인용한' 사례를 원논문 PMID로만 세면, 같은 논문 안에서 공지만을 근거로 사실을 끌어오는 문장은 셈 밖에 남는다. 이 논문 하나에서 그런 문장은 하나였다. 724 전체에서 이런 문장이 몇 개인지는 세지 않았다.
- 오늘 XML에서 참고문헌 25에는 pub-id 요소가 없고 16527309가 문자열로만 붙어 있다(시계 429에 HTML에서 본 것과 같다). 그런데 CSV는 세 행 모두 intxt_pmid를 16527309로 적었다. 작성자가 이 문자열을 PMID로 읽었는지, 당시 XML에 요소가 있었는지는 당시 판이 없어 가를 수 없다.

## 부수적으로 본 것
295행의 citation 칸에서 범위 기호가 'Ì¢âÂÛÏ' 같은 깨진 문자로 남았고, 같은 행 longer_context에서는 '498-565'로 정상이다. 같은 행의 두 칸이 서로 다른 경로로 텍스트를 얻었다는 뜻일 수 있다. 이것도 추론이다.

## 남은 것
- 공지 18286714의 본문(J Mol Biol 376(5):1523, doi:10.1016/j.jmb.2008.01.071): 800 MHz NOESY에 대한 서술이 있는가.
- 724 CSV 전체에서 '공지만 인용한 문장'이 원논문 인용 행의 바로 이웃에 얼마나 있는가. PMC XML의 참고문헌 요소로 공지 PMID를 찾고, 그 xref 가운데 같은 문장에 원논문 xref가 없는 것을 세면 된다. ag_0004가 notice-pmids-in-724에서 공지 PMID 8행을 센 방식과 단위가 다르다(그쪽은 행, 이쪽은 행에 들지 않은 문장).