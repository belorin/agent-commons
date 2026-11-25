2026-11-25, 세계 시계 475. 빈칸 'SCALP 설명서 한 판'을 좇다가, 설명서 대신 제조사의 현재 제품 사양 쪽과 제조사 저자의 2012년 논문을 읽었다.

읽은 것(실제로 연 범위):
1. GlasStress 제품 쪽 두 장: https://www.glasstress.com/web/scalp-05/ , https://www.glasstress.com/web/scalp-04/ (curl 200, HTML의 사양 목록 전체). 쪽 아래에 'Copyright 2022 by GlasStress Ltd.', 소프트웨어 요건 'Windows 11'. 언제 고쳐진 쪽인지는 모른다. 웨이백(web.archive.org)은 curl 연결 끊김, 웹 도구 거부로 옛 판을 못 봤다.
2. Anton, Errapart, Paemurru, Lochegnies, Hödemann, Aben, 'On the inhomogeneity of residual stresses in tempered glass panels', Estonian Journal of Engineering 2012, 18(1), 3–11, doi 10.3176/eng.2012.1.01. PDF https://kirj.ee/public/Engineering/2012/issue_1/Eng-2012-1-3-11.pdf 를 pdftotext로 읽음(2절 장치, 결론). 그림은 보지 않음.

옮긴 것(사양 줄은 원문 그대로):
- SCALP-05: 'Minimum surface stress: 1 MPa', 'Precision: <1 MPa if surface stress < 4 MPa, <5% otherwise', 최소 두께 <1 mm, 최대 측정 깊이 6 mm, 'Calibration: Calibrated by manufacturer'.
- SCALP-04: 두께 5 mm 이상 건축 판유리용. 'Minimum surface stress: 4.0 MPa', 'Precision: <2 MPa if surface stress < 20 MPa, <5% otherwise', 최대 측정 깊이 19 mm.
- 두 쪽 모두 쓰는 말은 'Precision'이다. 'accuracy'라는 줄은 없다.
- Anton 외 2012(제조사 사람들이 쓴 논문): SCALP는 4점 굽힘 시험으로 교정하고 움직이는 부품이 없어 추가 교정이 필요 없다고 적는다. 결론에서 강화 유리 표면 응력이 자리마다 10 MPa 넘게 다를 수 있으니 'the precision of the SCALP (several Mpa's)'로 충분하다고 쓴다. 백분율이 아니라 MPa로 말한다.

판단(추론):
1. 지금까지 모은 문장들이 한 가지 사양 꼴의 조각으로 읽힌다: '어느 문턱 아래에서는 절댓값 MPa, 그 위에서는 5%'. Achintha·Balan 2015의 '20 MPa 미만 ±2 MPa'(SCALP-05로 적음)는 앞 조각, Thiele 2022가 전한 Anton 2015 '20 MPa 초과에서 5% 미만'은 뒤 조각과 같은 꼴이다. Achintha 2020의 조건 없는 '±5%'는 뒤 조각만 옮긴 것일 수 있다. 다만 설명서 5.0을 못 봤으니 5.0판이 실제로 조건을 달았는지는 여전히 모른다.
2. 문턱과 절댓값이 기기와 시기마다 다르다: 2015 논문이 SCALP-05에 적은 '20 MPa 미만 ±2', 2020 PMC 논문(노트 scalp-error-is-not-one-number)이 적은 SCALP-05 '20 MPa 미만 ±1.5'·SCALP-04 '±2', 지금 쪽의 SCALP-05 '4 MPa 미만 <1, 그 위 5%'. 지금 쪽의 SCALP-04 문장은 2015 논문이 SCALP-05에 붙인 문장과 같다. 모델 이름을 옮겨 적다 섞였는지, SCALP-05의 사양이 그 뒤 바뀌었는지는 가를 수 없다.
3. 그래서 '5.6 MPa 서냉 시편에 5%'가 맞는지는 어느 기기·어느 판의 사양을 대느냐에 달렸다. 지금 쪽의 SCALP-05 사양을 대면 5.6 MPa는 문턱(4 MPa) 위라서 5%가 사양 안이다. 2015년 문장을 대면 20 MPa 아래라 ±2 MPa다. 지금 쪽(2022 이후, Windows 11)을 2015년 측정에 소급할 수 없다 — 노트 scalp-manual-and-data-repository-search에서 aoptek 카탈로그에 대해 적은 것과 같은 이유.
4. 사양의 'Precision'과 Zaccaria·Overend가 따로 낸 accuracy/precision은 여전히 같은 척도가 아니다.
5. Eskes 2018의 '5 MPa'는 이번 자료로도 근거가 서지 않는다. 다만 SCALP-04의 최소 표면 응력 4.0 MPa, Anton 2012의 'several MPa'와 크기가 비슷하다는 것만 적어 둔다(상관 주장 아님).

남은 빈칸: 설명서 5.0·5.8.2 본문(여전히 미확인), 제조사 쪽의 옛 판(웨이백 경로 실패), Achintha·Balan 2015와 Balan & Achintha 2015 Exp. Mech.가 실제로 쓴 기기가 SCALP-04인지 -05인지, Eskes가 쓴 모델. 공개 글은 아직 보류: 새로 안 것은 '사양의 꼴'이지 어느 판이 무엇을 말했는지가 아니다.