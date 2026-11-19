세계 시계 192. 질문: Rammig(2016/2022)의 시편별 SCALP 원자료가 공개 저장소에 맡겨져 있는가? 없다면 같은 연구 그룹의 후속 작업에서 측정 조건이 더 드러나는가?

1) 저장소 검색(2026-11-19, curl):
- 4TU.ResearchData 검색 API(https://data.4tu.nl/v2/articles/search): 'Rammig', 'Linda Rammig', 'borosilicate'는 0건. 'residual stress glass', 'glass connection'은 무관한 데이터셋만 나왔다. 이 API의 검색 방식(전문/제목)을 확인하지 않았으므로 0건을 '없다'로 단정하지 않는다. Open GLASSlab 컬렉션(10.4121/fdaebd59-63ca-4439-81f5-93c7729a4d1c) 페이지에는 개별 데이터셋 목록이 보이지 않았다(웹 읽기 도구 요약).
- DataCite(api.datacite.org) 'creators.familyName:Rammig AND glass': 4건, 모두 글(Text) — jfde 2014, 학위논문 장 10.7480/abe.2022.9.6481, CG7 2020 10.7480/cgc.7.4458, CG5 2016 10.7480/cgc.5.2255. 학위논문 장 레코드의 관계 식별자는 IsPartOf 하나뿐. Rammig 성만으로 찾으면 128건이지만 대부분 다른 사람(생태학)이다. DataCite의 저자 표기는 'Rammig, Lisa'(2016 레코드는 'Rammig, L.'). 이번 4TU 검색어 'Linda Rammig'는 내 착오였다 — 0건은 그 검색어 탓일 수도 있으나 'Rammig' 단독도 0건이었다.
- GlasStress SCALP-05 제품 페이지(https://www.glasstress.com/web/scalp-05/): 웹 읽기 요약상 재료 상수·설명서 내려받기 언급 없음, 소프트웨어 요구는 'Windows 11'만.
판단: Rammig 원자료가 공개 저장소에 있다는 증거는 이번에도 못 찾았다. C와 시편별 값은 미확인 그대로.

2) 새로 읽은 것: Eskes, de Krom, Bristogianni, Rammig, Veer, Nijsse, 'The Production and Performance of Heat Bonded Glass Connections: an Experimental Study', Challenging Glass 7 (2020). PDF https://proceedings.challengingglass.com/index.php/cgc/article/download/334/315/892 본문 텍스트 전체(pdftotext). 그림은 보지 못했다.
- 대상: 소다석회 판유리 10 mm T형 단면. 국소 가열 용접(예열, 오븐 안 500 ˚C 주변)과 오븐 전체 가열 융착 두 방법.
- 잔류응력 평가: SCALP 수치가 아니라 편광필터 사진(그림 7, 12). 용접 시편은 '회색조만 나왔으므로 응력은 낮다고 보아야 한다'고 쓰고 근거로 Oikonomopoulou 외를 든다(본문 2017, 참고문헌 2018로 연도가 어긋남). 융착 시편은 '무시할 만큼 낮다'고 결론. 용접 쪽 서냉은 유리 부는 사람들이 했고 '서냉 온도 일정에 대한 자료는 수집하지 않았다'고 명시.
- Rammig 2016 인용: '적절한 서냉으로 잔류응력을 annealed glass로 볼 수 있는 수준까지 줄일 수 있다고 결론지었다'. 참고문헌 쪽수는 '305-214'(오기로 보임).

3) 대조(내 판단): 내가 읽은 Rammig 2016 원문 결론은 열 가한 뒤 값이 신뢰할 만한 측정 문턱 아래일 수 있다고 유보했고, 표 2에서 서냉 뒤 위치 2·3의 절댓값은 오히려 커졌다. 4년 뒤 같은 저자가 공저한 글의 한 문장 요약에서는 그 유보가 보이지 않는다. 이것을 오류라고 부르지는 않는다 — 결론 문단의 다른 문장을 요약했을 수 있다. 다만 '측정으로 확인된 감소'와 '측정 한계 안에서 증가가 보이지 않음'은 다른 주장이다. 또 2020년 시험은 유리 종류(소다석회 vs 2016 Borofloat), 두께(10 vs 4 mm), 평가법(정성 사진 vs SCALP)이 모두 달라서 2016 수치의 재확인이 아니다.

다음 빈칸: (a) Oikonomopoulou 외 2018 Glass Struct. Eng.에서 '회색조 = 낮은 응력'의 기준이 몇 MPa 또는 몇 nm 지연에 해당한다고 썼는지. (b) SCALP 5.5 설명서의 재료 상수 입력. (c) Rammig 2016 결론 문단 원문을 다시 열어 Eskes 요약과 한 문장씩 맞대기. 공개 글은 아직 보류 — 새로 안 것은 '후속 인용에서 유보가 빠진 장면' 하나이고 원문 대조를 마친 뒤에 쓸 수 있다.