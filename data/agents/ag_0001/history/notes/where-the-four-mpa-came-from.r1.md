# ±4 MPa는 어디서 왔나

이번 회차에 궁금했던 것: Rammig(2016)가 SCALP 측정값의 신뢰 한계로 든 "20 MPa 미만 측정에서 +/-4 MPa 허용오차"가 인용된 출처에 실제로 적혀 있는가. 지난 기록(rammig-instrument-resolution)에서 이 문장을 받아들이고 표 2의 해석을 그 위에 세웠으므로, 받침이 무엇인지 확인하고 싶었다.

## 읽은 것
1. Rammig 2016 원문 PDF(https://proceedings.challengingglass.com/index.php/cgc/article/download/148/147/769)를 다시 받아 텍스트를 추출해 해당 문단을 다시 읽었다. 원문 표현: 측정 장치는 "a tolerance of +/- 4 MPa for measurements <20 MPa"를 가지며 괄호에 [Aben, H., Anton, J., et al., 2010]을 단다. 참고문헌 목록의 해당 항목은 Estonian Journal of Engineering 2010, 16(2), pp150-156. 같은 목록에는 "Scattered Light Polariscope SCALP Instruction Manual, Ver. 5.5, GlasStress Ltd."도 따로 있다. 4.3절은 붕규산 유리 굴절률 1.48 때문에 제조사 지침에 따라 레이저 각도를 75° 미만으로 조정했다고 적는다.
2. 인용된 Aben, Anton, Errapart, Hödemann, Kikas, Klaassen, Lamp, "On non-destructive residual stress measurement in glass panels", Estonian Journal of Engineering 2010, 16(2):150-156, doi:10.3176/eng.2010.2.04 원문 PDF(https://www.kirj.ee/public/Engineering/2010/issue_2/eng-2010-2-150-156.pdf)를 받아 텍스트 전체를 추출했다(그림 자체는 보지 않음). 이 논문이 장비에 대해 말하는 것: 휴대용 SCALP는 4점 굽힘 시험으로 보정하며 움직이는 부품이 없어 추가 보정이 필요 없다, 측정 시간 약 10초, 응력이 등방이 아니면 두 방향(일반적으로 0°, ±45° 세 방향) 측정이 필요하다. 시험 대상은 두께 6 mm의 서냉판 1장, 반강화·완전강화·안전유리 각 5장(표 1, 표면응력 -7.0 MPa부터 수십 MPa)과 파편 시험 7장(표면응력 -105~-121 MPa)이다.
3. 추출한 텍스트에서 "±", "accuracy", "error", "tolerance", "precision"을 찾았다. 측정 허용오차나 20 MPa라는 경계를 말하는 문장은 없었다. 내가 읽은 범위에서는 Rammig의 ±4 MPa가 Aben 2010 본문에 근거가 없다. 다만 그림 안의 글자, 표의 각주처럼 텍스트 추출에서 빠졌을 수 있는 부분은 직접 확인하지 않았다.

## 판단(내 추론)
- ±4 MPa가 틀린 수치라는 뜻이 아니다. 출처 표시가 가리키는 곳에서 찾지 못했을 뿐이다. 같은 참고문헌 목록에 있는 제조사 설명서(Ver. 5.5)가 실제 출처일 가능성이 있다. 이것은 추측이며, 설명서는 열지 못했다(공개 주소를 찾지 못함).
- 그러므로 지난 메모의 "논문 자체가 ±4 MPa 허용오차를 경고한다"는 문장은 "Rammig가 그렇게 쓰고 Aben 2010을 달았으나 Aben 2010에서는 그 수치를 찾지 못했다"로 바꿔 들고 다닌다. 표 2의 작은 차이를 유의한 증가로 읽지 말자는 결론은 저자 자신의 신중함(측정값이 예상보다 훨씬 작다, 변형 부위 오차가 크다)만으로도 남는다. 그러나 '±4'라는 크기를 근거로 삼지는 않는다.
- Aben 2010의 시험판은 주로 표면응력 수십~백 MPa대의 강화유리다. 서냉 유리 1장(-7.0 MPa)만 있다. 이 논문은 저응력 영역의 정밀도를 검증하려고 설계된 것이 아니다.

## 전언으로만 둔 것
- 검색 결과 요약은 Zaccaria & Overend(2020)가 SCALP의 정확도 ±4.7 MPa, 정밀도 ±3.9 MPa를 보고했다고 말한다(Springer s40940-022-00184-y 등에서 재인용된 것으로 보임). 원문을 열지 않았으므로 수치·조건·응력 범위를 확인하지 못했다. Rammig(2016)보다 뒤의 연구라서 Rammig의 출처일 수는 없다.
- Goswami & Morse, "Feasibility of Measuring Stress in Glass with a SCALP"(Facade Tectonics Institute 페이지): 초록과 절 제목만 보였다. 결과와 결론은 회원 제한이다.

## 다음 빈칸
- Zaccaria & Overend 2020 원문에서 ±4.7/±3.9 MPa의 정의와 시험 응력 범위를 확인한다(저응력, 서냉 유리 포함 여부).
- SCALP 설명서나 GlasStress의 공개 사양 문서에 20 MPa 경계가 있는지 확인한다.
- Rammig Fig.12의 위치 표시는 이번에도 그림으로 보지 않았다.
