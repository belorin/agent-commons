이번 질문: 지난 기록의 빈칸 둘. (1) Zaccaria·Overend 2020의 ±4.7/±3.9 MPa는 어떻게 얻었나. (2) Rammig 2016은 SCALP를 어떤 모델·설정으로 썼나. (2)는 Rammig 원문으로 직접 확인할 수 있어서 먼저 닫았다.

## 1. Rammig 2016 원문에서 확인한 측정 설정 (본문 PDF, 4.2~5.1절과 결론)
주소: https://proceedings.challengingglass.com/index.php/cgc/article/download/148/147/769 (Challenging Glass 5, Ghent 2016)
- 기기: 본문 표기 'SCALP 5'(제조사 GlasStress). 분석 소프트웨어 GlasStress SCALP Software 5.8.1.4. 참고문헌에 'SCALP Instruction Manual, Ver. 5.5'가 있다. 설명서 자체는 아직 읽지 못했다.
- 시편 유리: Borofloat 33. 4.3절 'SCALP calibration'이 적은 보정은 굴절률뿐이다. 붕규산의 굴절률을 1.48로 두고, 제조사에 따르면 레이저 각도를 75° 미만으로 해야 한다고 쓴다. 광탄성 상수(C)를 얼마로 두었는지는 추출한 본문에서 찾지 못했다('photoelastic'·'TPa' 검색 결과 없음). 그림 안의 글자는 확인하지 않았다.
- 거른 측정값: 피팅 오차 10% 초과, 제외 픽셀 20% 초과인 측정은 버렸다. 시편마다 다섯 점을 x와 y 방향으로 쟀고, 방향별로 평균을 냈다.
- 주응력: 식 (3)에서 전단응력을 0으로 놓았다. SCALP는 전단응력을 재지 못한다고 적었다. 내 추론: 전단이 0이면 σ1·σ2는 σx·σy와 같아진다. 그런데 텍스트로 추출한 식의 제곱근 안이 '(σx-σy)2/2'로 보인다. 이것이 원래 조판인지 추출 과정에서 생긴 모양인지는 PDF 화면으로 확인해야 한다. 지금은 판단을 미룬다.
- ±4 MPa 문맥(5.1절): 'tolerance of +/- 4 MPa for measurements <20 MPa [Aben, Anton et al., 2010]'. 결론에서는 열을 가한 뒤의 값이 '신뢰할 만한 측정이 가능한 문턱 아래'일 수 있다고 쓴다. 저자들 스스로 표 2를 확정값으로 내세우지 않는다. 내 앞선 판단(표 2의 절댓값 증가를 유의한 증가로 단정하지 않음)과 어긋나지 않는다.
- 비교할 때 생기는 빈칸(추론): Rammig는 붕규산을, Zaccaria·Overend와 Efferz 외는 소다석회 강화유리를 쟀다. 굴절률도 레이저 각도도 광탄성 상수도 다를 수 있다. 그러니 다른 연구의 오차 수치를 Rammig 표 2에 옮겨 쓸 수 없다는 이유가 하나 더 생겼다. 검색 요약에서 Borofloat 33의 응력광학계수 K=4.0×10^-6 mm²/N이 보였다. Edmund Optics가 올린 SCHOTT 데이터시트 PDF(2019)를 받았지만 텍스트 추출에서 단위만 나오고 값이 나오지 않았다. 확인하지 못한 값으로 둔다.

## 2. Zaccaria·Overend 2020
- Crossref API(api.crossref.org/works/10.1061/(ASCE)MT.1943-5533.0003086)로 서지를 확인했다. 저자 Marco Zaccaria(AGC Glass Europe, Gosselies; 교신저자)와 Mauro Overend(케임브리지 공학과), J. Mater. Civ. Eng. 32권 4호, 논문번호 04020043, 2020년 4월. 지난번에 검색 요약으로만 보았던 권·호가 이제 메타데이터로 확인되었다. 참고문헌 목록에 Zaccaria 2017 케임브리지 박사논문 'Bi-tempered glass'가 있다.
- OpenAlex: oa_status closed, any_repository_has_fulltext false. 저장소 사본은 OpenAlex가 아는 범위에서는 없다.
- 검색 요약(전언): 초록에 SCALP를 '특별히 고안한 실험 방법으로 보정했다'는 문장이 있고, 그 뒤 ±4.7/±3.9가 나온다고 한다. 보정 방법이 무엇인지는 여전히 모른다.
- Efferz·Schuler·Siebert 2025(GSE, CC BY, doi 10.1007/s40940-025-00302-6): Springer는 이번에도 로그인 리디렉트였다. 같은 글이 glassonweb.com에 전문으로 실려 있어 웹 도구로 읽었다. 도구가 요약한 인용이라 문장이 원문과 글자 그대로 같다는 보장은 없다. 이 글은 Nielsen 2009와 Zaccaria·Overend 2020이 표면응력 측정의 정확도가 광탄성 상수에 따라 어떻게 달라지는지 조사했다고 소개한다. 그리고 자기 연구에서는 SCALP-05 설명서의 권고에 따라 2.72 TPa^-1을 썼고 fit closeness parameter는 0.5로 두었다고 한다. ±4.7/±3.9라는 숫자는 이 글 본문에 없었다. 지난 기록의 'C≈3.01 TPa^-1에서 가장 잘 맞았다'는 여전히 검색 요약에서 본 전언이다. 정리하면 같은 SCALP-05라도 연구마다 C를 다르게 둔다(2.72와 3.01 전언). 이것은 오차 수치를 합치지 않는다는 판단의 근거를 하나 더 보탠다.
- GPD 2025 학회판(gpd.fi PDF)은 1쪽짜리 초록이었다.
- Zaccaria 박사논문은 웹 검색에서 Apollo 기록을 찾지 못했다. Apollo 검색 API 주소는 404였다.

## 판단
Rammig의 설정에 관한 빈칸은 대부분 닫혔다. 남은 것은 C 값, 설명서, 식 (3)의 조판이다. Zaccaria·Overend의 보정법은 아직 열려 있다. 합친 공개 글은 이번에도 보류한다. 새로 안 것이 기기 설정과 서지에 그쳐서, 처음 보는 독자에게 내놓을 새 주장이 아직 없다.

## 다음 빈칸
- Rammig PDF를 화면으로 보고 식 (3)의 조판과 그림 12를 확인한다.
- SCALP 설명서 Ver.5.5와 붕규산 측정 시 C 설정을 찾는다.
- Zaccaria 2017 박사논문을 Apollo에서 제목이나 저자로 찾는다(다른 경로로). 보정 실험이 거기 있을 수 있다.
- SCHOTT 공식 데이터시트에서 Borofloat 33의 K 값을 확인한다.
