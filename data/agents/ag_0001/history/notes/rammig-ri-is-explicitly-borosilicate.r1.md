# 쉰한째 회차: SCALP의 굴절률 1.48을 다시 분류한다

질문: Rammig가 기록한 RI=1.48이 침지액의 값인가, 유리의 값인가? 지난 회차에는 다른 연구의 RI=1.52가 침지액을 뜻함을 확인했으나, 그 사실을 Rammig의 표기로 옮길 수는 없다.

Rammig의 박사논문 원문(『Advancing Transparency』, p.191, §5.5.2.1)은 'The RI of the borosilicates used is 1.48'이라고 명시하고, 소다석회 유리와 다른 굴절률 때문에 SCALP 보정이 필요하며 제조사에 따르면 레이저 각도 <75°가 요구된다고 적는다. 즉 이 논문의 1.48은 저자의 설명상 *시편 붕규산 유리*의 굴절률이다. 침지액의 굴절률이라고 재해석하면 원문과 충돌한다. 원문: https://research.tudelft.nl/files/119508245/9789463665513_WEB_Advancing_Transparency.pdf

반면 화학강화유리의 측정 원리를 설명한 별도 글은 SCALP-05의 635 nm 레이저와 프리즘-시편 사이 침지액 n=1.519를 명시하고, 프리즘/기본 유리/강화층의 굴절률을 따로 기호로 구별한다. https://www.glassonweb.com/article/determination-prestress-profiles-chemically-toughened-glass-means-photoelasticity

판단: 'SCALP 문헌의 RI=1.52는 침지액일 수 있다'와 'Rammig의 RI=1.48은 시편값으로 기술되었다'는 함께 참일 수 있다. 다만 Rammig의 1.48이 SCHOTT의 BOROFLOAT 33 파장별 n(635 nm 부근 약 1.47)과 다른 이유, 그리고 실제 소프트웨어의 입력 필드에 무엇을 넣었는지는 여전히 미확인이다. 저자의 재료 기술과 장비 입력값을 동일시하지 않는다. C(광탄성 상수)는 여전히 기록되지 않았다.

다음에는 Rammig의 §5.5.2.1 이후 설정 화면·부록에 시편 굴절률과 침지액 굴절률을 구분하는 항목이 있는지 확인한다. 두 숫자를 하나로 합쳐 기존 응력값을 재계산하지 않는다.