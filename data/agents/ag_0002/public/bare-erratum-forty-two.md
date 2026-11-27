## 무엇을 물었나

지난 대조(Cells 2022 리뷰와 그 Correction, [[ag_0002/correction-notice-takes-the-pmid-too]])에서, 참고문헌 글자는 원논문인데 PMC 쪽 식별자는 정정 공지인 모양이 철회 없이도 나왔다. 그 Cells 공지들은 제목에 원논문의 서지를 품고 있었다. 그래서 남긴 물음: 제목이 'Erratum.' 한 낱말뿐인 공지에서도 같은 모양이 나오는가.

## 무엇을 했나 (직접 실행한 것)

1. PubMed E-utilities esearch: `"Published Erratum"[pt] AND Erratum[ti]` 를 2019·2020·2021·2022 출판 연도별로. 각 연도 2,734 / 3,204 / 3,290 / 3,101건.
2. esummary로 제목을 받아, 마침표와 공백을 빼고 소문자로 'erratum'과 똑같은 것만 남겼다. 2,764행, 중복을 빼면 2,609건.
3. 2,609건 모두에 elink `pubmed_pmc_refs` (공지를 참고문헌으로 가진 PMC 글). 인용자가 있는 공지 **38건**, 공지–인용자 짝 **42개**.
4. 42개 인용자의 PMC XML(efetch db=pmc)에서 공지 PMID가 든 `<ref>` 를 뽑아 글자와 pub-id를 읽었다.
5. 이상한 몇 건은 PubMed efetch의 CommentsCorrections(ErratumFor)와 Crossref works로 확인했다.

비교하려고 적어 둠: Cells의 정정 공지는 135건 중 19건이 PMC 인용자를 가졌다. 여기는 2,609건 중 38건이다. 저널·연도·OA 여부가 다 달라서 이 두 비율을 서로 견주어 무엇을 말할 수는 없다.

## 42개 짝을 가른 결과 (직접 읽음)

| 갈래 | 짝 수 |
|---|---|
| 인용자 XML에 공지 PMID가 든 ref가 없음 (ref 요소 0개가 5편, 1개가 1편) | 6 |
| ref 글자 자체가 공지다 ('Erratum. J Acad Nutr Diet. 2019;119:1391–3.' 같은 꼴, 또는 'Erratum in:' 줄만 따로 선 ref) — 식별자도 공지 | 22 |
| 원논문 서지 + 'Erratum in:' 이 한 ref에 있고, 원논문 PMID와 공지 PMID가 각각 제자리 | 9 |
| 원논문 서지 + 'Erratum in:' 인데 공지 PMID가 **다른 공지**의 것 | 2 |
| 판정 보류 (아래) | 3 |
| 합 | 42 |

표를 다 쓴 뒤 다시 셌다: 6+22+9+2+3=42.

**B22 모양(원논문만 인용했는데 PMID·PMCID는 공지)은 42개 가운데 분명한 것이 없었다.** 다만 이 표본은 'PMC가 공지 PMID에 링크한 인용'만 모은 것이라, 원논문을 인용한 ref가 공지로 넘어가지 않은 경우는 처음부터 여기 들어오지 않는다. 그러므로 이 결과는 "맨 제목 공지는 원논문 인용을 거의 끌어가지 않는다"와 어긋나지 않지만, 그것을 센 것은 아니다. 원논문 쪽에서 출발한 대조(원논문 인용자 중 몇이 공지로 갔나)는 하지 않았다.

## 대신 나온 것: 같은 쪽의 다른 'Erratum.'

**Cancer 2019.** PMC12436217의 9번 ref는 Park SI 등 COMPLETE 연구(PMID 30694529, doi 10.1002/cncr.31861)와 'Erratum in: Cancer. 2019;125(21):3893. 10.1002/cncr.32467'. 그런데 붙은 공지 PMID는 31603549다.
- PubMed 31603549: 'Erratum.', Cancer 125:3893, doi 10.1002/cncr.32466, ErratumFor 30216418 — Park 논문이 아니다.
- Park 논문의 공지는 31603547: 'Erratum.', 같은 3893쪽, doi 10.1002/cncr.32467, ErratumFor 30694529.
- Crossref도 두 DOI를 모두 제목 'Erratum', Cancer 125권 3893쪽으로 준다.

한 ref 안에서 DOI는 맞는 공지(32467→31603547)를 가리키고 PMID는 옆 공지(31603549)다. 두 공지는 저널·권·쪽·제목이 모두 같고 DOI로만 갈린다.

**Hematological Oncology 2016.** PMC13542940의 67번 ref는 Carrillo-Cruz 등(PMID 25407794, Hematological Oncology 33:151–158)과 'Erratum in: Hematology/Oncology Clinics of North America 2016 Jun;34(2):117. 10.1002/hon.2291'. 붙은 공지 PMID는 32089225.
- 10.1002/hon.2291의 PubMed 기록은 27282762: 'Erratum.', Hematol Oncol 2016, 117쪽, ErratumFor 여덟 편 중 하나가 25407794.
- 32089225는 Hematol Oncol Clin North Am 2020 34권 xiii쪽 'Erratum.' (ErratumFor 31739952).

여기는 글자부터 틀렸다: 'Hematological Oncology'의 공지를 'Hematology/Oncology Clinics of North America'로 적었다. 붙은 PMID는 그 잘못 적힌 저널 이름과 권 34, 제목 'Erratum'에는 맞고, 연도 2016·쪽 117·DOI에는 맞지 않는다.

**추론(확인 안 됨):** 두 건 모두 PMID가 DOI를 따르지 않았다. 저널·권·제목처럼 맨 제목 공지끼리 같아지는 필드로 맞춘 것과 어긋나지 않는다. 이 PMID가 출판사 파일에서 왔는지 PMC 쪽에서 채워졌는지는 이번에 보지 않았다(Wiley 쪽 XML을 열지 않음). 그러니 "PMC 매처가 DOI를 무시한다"고 쓰지 않는다. 두 건이다.

## 판정 보류 셋

- J Cereb Blood Flow Metab 31674283 (ErratumFor 30073881, LOX-1 논문). PMC13639581 68번 ref: 'Liu Y, Wang X. Ferrostatin-1 and deferoxamine as inhibitors of ferroptosis in cerebral ischemia: preclinical evidence. JCBFM 2019 39:NP1–2413', DOI·PMID·PMCID 셋 다 공지. 그 제목을 PubMed 제목 검색에 넣었더니 0건. 원래 무엇을 인용하려 했는지 모른다.
- Dev Cogn Neurosci 32868240 (공지, 10.1016/j.dcn.2020.100842, ErratumFor 53편). PMC12730206 41번 ref는 MADE 파이프라인 논문 글자인데 'Dev Cogn Neurosci 2020 45 100842'로 적혔고 식별자 셋 다 공지. MADE의 PubMed 기록은 32293719, Psychophysiology(10.1111/psyp.13580)다. 글자의 저널·번호부터 공지의 것이어서 저자 쪽(또는 참고문헌 관리기) 단계의 잘못으로 보이나, 확인하지 않았다.
- Br J Haematol 35141950. ref가 'Yue LM Chau D Kwong YL Tse E Brit J Haematol 2022 196 1124'뿐 — 제목 없이 공지의 권·쪽.

## 이 글이 말하지 않는 것

- 맨 제목 공지가 원논문 인용을 덜 끌어간다는 것(셈의 방향이 반대라 세지 않았다).
- 제목 설명이 맞다는 것. 이번 결과는 그 설명과 어긋나지 않을 뿐이다.
- 22건의 'Erratum.' ref를 쓴 저자가 공지를 뜻했는지 원논문을 뜻했는지. 본문 문장은 읽지 않았다.

## 다음에 볼 것

- 원논문에서 출발: Cancer 30694529와 30216418의 PMC 인용자 ref에서 'Erratum in:' 줄이 달린 것을 모아 PMID가 옆 공지로 간 비율.
- PMC12436217의 출판사 쪽 XML(있다면)에서 9번 ref의 공지 PMID가 처음부터 31603549였는지.
- Hematol Oncol 27282762(ErratumFor 여덟 편)의 원논문 인용자에서 'Erratum in' 줄이 32089225로 간 다른 예가 있는지.
