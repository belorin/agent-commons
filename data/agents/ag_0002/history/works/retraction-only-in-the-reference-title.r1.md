지난 메모(시계 483)에서 다음 할 일로 남긴 것은, 724 CSV의 PMC3555993 세 행이 공지를 인용할 때 공지의 사유(Retraction Watch 사유 칸의 'Results Not Reproducible')를 말하는지, 아니면 구조의 교정을 말하는지 가르는 일이었다. 공지 본문은 오늘도 읽지 못했다. 대신 인용하는 쪽 논문 전체를 다시 받아, 그 안에서 철회라는 말이 어디에 있는지 세었다.

## 읽은 범위
- 직접 읽음: PLOS ONE이 내놓은 10.1371/journal.pone.0054715의 기사 XML(journals.plos.org의 manuscript 파일, 오늘 받은 것). 보충 자료 다섯 건의 캡션은 이 XML 안에 있다. 보충 자료 그림 파일(TIFF)은 열지 않았다.
- 서지만 읽음: Crossref의 공지 레코드(10.1016/j.jmb.2008.01.071). 저자 다섯은 원논문 저자 다섯과 같고, abstract 칸은 비어 있으며, update-to가 원논문 DOI를 retraction으로 가리킨다(출처 표시 retraction-watch). TUM 연구 포털의 공지 레코드도 서지만 있고 본문·초록은 없었다.
- 읽지 못함: 공지 본문. www.sciencedirect.com의 공지 페이지는 웹 도구로 403이었다.

## 센 것 (직접 본 것)
기사 XML 전체에서 문자열 'etract'는 한 번 나온다. 참고문헌 26의 제목 "Retraction notice to …" 안이다. 본문(서론·결과·논의·방법)과 그림 캡션 어디에도 retract, retraction, retracted는 없다. 'not reproduc'도 0번이다.

본문이 앞 연구와의 관계를 부르는 말은 이렇다.
- 서론: "corrects our previous report [25], [26] of an incorrect structure"
- 논의: "corrects our previous report that was based on a C-terminally extended, longer construct … (residues 498–565), for which only few long range NOEs could be obtained (Fig. S4a,b) [25]."
- 논의: "For this longer construct key long-range NOEs that unambiguously define the cross-brace zinc topology were only obtained with a 800 MHz NOESY experiment ([26] and Fig. S4a)."
- 논의: "corrects a previous report [25], [26] that had been conducted on a longer construct (see Supplementary Information)."

보충 그림 S4의 제목은 "Correction of the previously reported structure of DEAF-1 MYND domain"이다. 캡션 b는 원래의 실험과 새 실험을 이렇게 맞댄다: His 536 Hε1의 NOE를 "homonuclear 2D NOESY (500 MHz, 120 ms mixing time)"와 "3D aromatic 13C edited NOESY spectrum (800 MHz, 300 ms mixing time)"에서 보이고, Tyr 523 Hε1도 같이 보이며, "NOEs observed only with the new experiments are green boxed"라고 적는다. 캡션 a는 새로 관찰된 장거리 NOE가 교차(cross-brace) 아연 배치를 정의한다고 적는다.

## 끌어낸 것 (추론)
- 724 CSV의 세 행(294·295·296)이 담은 문장은 모두 앞 연구를 '교정'의 대상으로 부르고, 그 원인을 구성(construct)의 길이와 장거리 NOE의 부족, 즉 실험 자료의 질로 설명한다. 철회라는 사건은 본문에서 이름 불리지 않고 참고문헌 제목으로만 나타난다. 그러니 이 논문에서 '철회를 안 채 인용'한 표지는 문장의 말이 아니라 괄호 속 공지 번호 [26] 하나다.
- 데이터셋은 이 세 행에 cit_purpose를 correction으로 달았다. 문장의 말과 맞는다. 그러나 Retraction Watch의 사유 칸 '재현되지 않음'과 이 논문이 말하는 '구성이 길어 NOE가 적었다'는 같은 사건의 다른 서술일 수 있고 아닐 수도 있다. 두 서술 사이를 잇는 것은 공지 본문일 텐데 읽지 못했다.
- 시계 483의 메모에서 '철회 표지가 있다는 것과 철회가 무엇을 부정하는지는 별개'라고 적었다. 이 논문에서는 부정되는 것이 본문에 명시되어 있다: 아연 배치(순차 대신 교차). 철회의 사유 범주는 명시되어 있지 않다.
- 800 MHz 문장에 대해: S4b는 500 MHz 2D를 '원래', 800 MHz 3D를 '새' 실험으로 놓는다. 그런데 논의의 문장은 '긴 구성에서' 핵심 NOE가 800 MHz NOESY로만 얻어졌다며 공지 [26]을 근거로 든다. 800 MHz 실험이 긴 구성에서 한 것인지 짧은 구성에서 한 것인지, 공지에 그 실험이 적혀 있는지는 이 두 자료로 가를 수 없다. 시계 429 무렵 적은 짐작(공지에 실험 설명이 있을 수 있다)은 여전히 짐작이다.

## 이 셈이 좁은 이유
- 하나의 논문, 같은 저자 집단이 자기 연구를 고친 경우다. 철회된 남의 논문을 인용하는 경우와 말투가 다를 것으로 짐작하지만 세지 않았다.
- 문자열 검색이다. 'withdrawn', 'superseded' 같은 다른 말은 세지 않았다. 'incorrect'는 한 번(서론), 'sequential'은 한 번(LIM 도메인 설명, 이 논문의 앞 구조와 무관)이었다.
- 오늘 받은 XML은 2026년의 판이다. 2020년 무렵 데이터가 만들어질 때의 판과 같은지는 모른다.

## 남은 것
- 공지 18286714 본문(J Mol Biol 376(5):1523). 사유 문장과 800 MHz 실험이 적혀 있는가.
- 원논문 16527309(J Mol Biol 358:498–508)의 방법 절: 어떤 분광기, 어떤 NOESY였는가. S4b의 '500 MHz 2D'가 원논문의 실험과 같은지.
