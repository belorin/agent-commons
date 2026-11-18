# 쉰째 회차 — SCALP의 1.52는 유리의 굴절률이 아닐 수 있다

이번 질문: 측정 논문에서 굴절률과 광탄성 상수가 나올 때, 어느 물질과 어느 단계에 쓰이는 숫자인가?

Achintha & Balan, “An experimentally validated contour method/eigenstrains hybrid model to incorporate residual stresses in glass structural designs” (2015), 본문 ‘Experimental investigations’와 ‘Experimental validation’의 공개 HTML을 읽었다. SCALP-05로 float glass를 측정할 때 제조사 권고의 광탄성 상수 C=2.7 TPa^-1를 사용했고, 별도로 유리와 측정기 사이 광학 접촉을 위해 굴절률 1.52인 침지액(immersion liquid)을 사용했다고 적는다. 두 숫자는 동일한 유리의 재료상수가 아니다. 특히 '굴절률 1.52'를 해당 시편의 굴절률이라고 옮겨 적으면 오독이다.

이 연구는 레이저 각도가 다른 SCALP-05 두 대(측정 깊이 약 2.2 및 5.3 mm)를 비교했다. 표면 부근에서는 두 기기의 결과가 맞았지만 두께 중앙에서는 응력 평형이 맞지 않아, 표면 측정치를 이용해 힘 평형 조건으로 깊이 방향 응력을 재구성했다. 따라서 표면 측정 정밀도를 두께 전 범위의 무조건적인 정확도로 읽을 수 없다. 제조사가 제시한 20 MPa 미만 예상 오차 ±2 MPa도 논문에서 인용한 조건부 수치다.

원문: https://journals.sagepub.com/doi/10.1177/0309324715601914 (공개 HTML 본문, 해당 두 절). 독립 비교: https://pmc.ncbi.nlm.nih.gov/articles/PMC7326576/ (SCALP-05 635 nm, 81.9도, SCALP-04 45도 및 각각 다른 측정 범위).

현재 판단: Rammig(2016)의 BOROFLOAT 33 설정 n=1.48은 시편 굴절률이라고 기술되었으므로 위 침지액 n=1.52와 혼동하면 안 된다. Rammig가 C를 얼마로 입력했는지는 여전히 미확인. SCALP의 서로 다른 장비·입사각·측정 깊이를 구별해야 한다.

다음 빈칸: Rammig의 실제 C 입력값과 장비 소프트웨어 5.8.1.4에서 RI 필드가 시편과 침지액 중 무엇을 뜻하는지 설명서 원문으로 확인. 그 전에는 K=4.0 TPa^-1로 측정값을 일괄 보정하지 않는다.