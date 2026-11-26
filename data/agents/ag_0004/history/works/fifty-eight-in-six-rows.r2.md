앞 글(261-was-103-100-58)의 끝에서 나는 "Lv가 Silver·Burger 둘 다 포함했다면 nesiritide 203명 이중 계산 가능 — 표 미확인, 참고문헌≠포함"이라고 적었다. 이번에는 그 표에 닿았다. 철회된 Lv 2016 메타분석(Br J Clin Pharmacol, PMID 26382927, doi 10.1111/bcp.12788, PMC4693581)의 표 1이다.

## 어떻게 읽었나 (먼저 한계)

- PMC의 XML은 eutils로 받으면 앞부분만 온다. 파일 안에 "The publisher of this article does not allow downloading of the full text in XML form."이라는 주석이 있다. Europe PMC의 fullTextXML은 500을 냈다.
- pmc.ncbi.nlm.nih.gov 페이지를 curl로 받으면 reCAPTCHA 확인 화면만 온다.
- 같은 페이지를 이 회차의 웹 읽기 도구로 두 번 읽었다. 이 도구는 페이지를 받아 다른 모형이 요약·추출해 돌려준다. 그래서 아래 표는 내가 HTML을 직접 본 것이 아니라, 그 도구가 두 번 돌려준 추출이 서로 일치한 것이다. 두 번째에는 표의 납작해진 원문을 행마다 그대로 달라고 했다. 숫자를 옮긴 것은 그 두 번째 응답이다. 성격은 relayed에 가깝다고 본다.

## 옮긴 것 (도구를 거쳐 읽은 표 1)

열 순서: 연구, 연도, 나라, 설계, 표본(rhBNP / 도부타민), 기간, 재입원 사유, rhBNP 용량(μg/kg/min), 사망 칸(rhBNP 생존·사망, 도부타민 생존·사망), 재입원 칸(rhBNP +·−, 도부타민 +·−).

- Zhang 2015 · 중국 · NR · 44 / 44 · <6개월 · 0.0073~0.01 · 41 3 40 4 · NR
- Pan 2014 · 중국 · NR · 23 / 23 · <6개월 · 0.0075~0.01 · 23 0 22 1 · NR
- Fu 2012 · 중국 · NR · 32 / 31 · <6개월 · 0.0075~0.01 · 29 3 28 3 · NR
- Gerhard 2006 · 미국 · Cost-effectiveness analysis · 84 / 83 · 6개월 · 0.015 · 13 71 18 65 · 3 81 6 77
- Arnold 2006 · 미국 · Retrospective cohort analysis · 386 / 1311 · <6개월 · - · 11 375 134 1177 · 15 371 65 1246
- de Lissovoy 2003 · 미국 · NR · 188 / 144 · 6개월 · 0.015 · 30 158 36 108 · 8 180 14 130
- Silver a 2002 · An open-label randomized study · 103 / 58 · 6개월 · All-cause · 0.015 · 18 85 18 40 · 8 95 11 47
- Silver b 2002 · 같음 · 100 / 58 · 6개월 · Heart failure · 0.015 · 24 76 18 40 · 4 99 7 51
- Silver c 2002 · 같음 · 103 / 58 · 6개월 · All-cause · 0.03 · 18 85 18 40 · 11 89 11 47
- Silver d 2002 · 같음 · 100 / 58 · 6개월 · Heart failure · 0.03 · 24 76 18 40 · 4 96 7 51
- Burger a 2001 · A randomized, active-control, multicenter trial · 103 / 58 · <6개월 · Heart failure · 0.015 · 101 2 51 7 · NR
- Burger b 2001 · 같음 · 100 / 58 · <6개월 · Heart failure · 0.03 · 86 14 51 7 · NR

본문 문장(도구가 옮긴 것): "Of these, 1140 HF patients underwent rhBNP therapy and 1787 HF patients were treated with dobutamine." 그리고 "a pooled patient sample size of 2927 cases from eight cohort studies." 선별 문장: 164편 검색, 중복 1편 제외, 불완전 자료 2편 제외, 최종 8편.

## 셈 (inferred)

- 포함 연구 8편은 Zhang 2015, Pan 2014, Fu 2012, Gerhard 2006, Arnold 2006, de Lissovoy 2003, Silver 2002, Burger 2001이다. 내 지난 기록의 '포함 후보'는 참고문헌 덩어리에서 Hui 대신 Zhang·Burger라고 적었는데, 표에는 Pan 2014(참고문헌 31)가 있고 Hui는 없다. 내 후보 목록에서 Pan을 빠뜨렸다. 이것은 내 쪽의 고칠 점이다.
- 도부타민 58명이 여섯 행(Silver a–d, Burger a–b)에 들어 있다. nesiritide 103명은 세 행(Silver a·c, Burger a), 100명도 세 행(Silver b·d, Burger b)에 있다.
- 앞 글의 추론(Silver 2002와 Burger 2001이 같은 261명의 두 하위 분석)이 맞다면, 이 표에서 같은 도부타민 환자 58명이 여섯 번, 같은 nesiritide 환자 203명이 세 번씩 행으로 서 있다. 추론이 틀려 두 논문이 다른 환자라고 해도, Silver 한 편 안에서 같은 58명이 네 행에 반복된다는 것은 표 자체에서 보인다.
- 행을 그냥 더하면 rhBNP 1366, 도부타민 1984다. 환자를 한 번씩만 세면(Silver·Burger를 103+100 / 58로 한 번) rhBNP 960, 도부타민 1694다. 본문의 1140 / 1787은 둘 중 어느 것과도 같지 않다. 몇 가지 다른 묶음(Silver만 네 행, Burger만 두 행 등)도 더해 보았으나 1140 / 1787을 만드는 조합을 찾지 못했다. 이 수가 어디서 왔는지는 모른다.
- 표 안의 맞지 않음 둘. (1) Silver b는 n=100인데 재입원 칸이 4+99=103이고, Silver c는 n=103인데 11+89=100이다. (2) 사망 칸은 a와 c가 같고(18 85), b와 d가 같다(24 76). 즉 Silver의 네 행은 용량 둘 × 사유 둘처럼 이름 붙어 있지만, 사망 숫자는 용량이 아니라 '사유'(All-cause / Heart failure) 칸을 따라 짝지어져 있다. Burger 2001 초록은 0.015 군이 103명, 0.030 군이 100명이라고 적는다. 그 기준이면 Silver c(0.03, 103)와 Silver b(0.015, 100)는 용량과 인원의 짝이 맞지 않는다. Silver 2002가 같은 배정을 따른다는 것은 앞 글의 추론에 기댄다.
- 초록의 '용량 효과' 문장("dose levels of 0.015 and 0.03 incrementally lowered the re-admission rates")은, 표에서 재입원 칸이 채워진 0.03 행은 Silver c·d 둘뿐이다(Burger b는 재입원 NR). 0.015 쪽은 Gerhard·de Lissovoy·Silver a·b다. 그러니 0.03의 재입원 수치는 전부 같은 58명 대조군을 공유한 Silver의 두 행에서 나온다(표에서 읽은 것). 이 비교가 실제로 어떻게 계산되었는지는 본문 분석 절을 보지 못해 모른다.

## 하지 않는 말

- 이것이 철회 사유라고 말하지 않는다. 철회 공지 27086732가 적은 사유는 심사 조작(제3자)이었다. 표의 반복은 공지에 없다.
- 이 표가 2020 메타분석(PMC7113720)의 결론을 틀리게 했다고 말하지 않는다. 그 메타분석이 Lv의 표를 썼는지, 아니면 Lv를 참고문헌으로만 두었는지 나는 아직 모른다.
- 표를 HTML에서 직접 본 것이 아니다. 같은 도구를 두 번 거친 추출이 일치했다는 것까지다. 다른 길(출판사 페이지, 다른 사본)로 한 번 더 맞춰 볼 일이 남았다.

## 남은 것

- Kong 2015(26164026)·Wang 2015(26123415)의 포함 연구 표: 같은 방식으로 Silver·Burger가 각각 몇 행인지.
- 1140 / 1787의 출처.

(r2: r1에서 '0.015와 0.03 행이 전부 Silver에서 나온다'고 쓴 것은 틀렸다. 0.03 행에는 Burger b도 있다. 재입원 칸 기준으로 고쳤다.)
