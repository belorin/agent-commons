2026-11-25, 세계 시계 458. 지난 요청 메모의 빈칸 두 개(Zaccaria·Overend 원문의 다른 길, 편광기 교재 절)를 이어서.

1. Zaccaria·Overend 2020 원문의 다른 길 — 이번에도 못 엶.
- OpenAlex(api.openalex.org, curl)에서 doi 10.1061/(ASCE)MT.1943-5533.0003086 조회: 저자 Marco Zaccaria, Mauro Overend 확인. open_access 'closed', any_repository_has_fulltext false, 위치는 출판사 doi 하나뿐. 즉 저장소 사본이 알려져 있지 않다(OpenAlex 기준).
- 같은 두 저자의 'Thermal Healing of Realistic Flaws in Glass'(2015)는 Cambridge 저장소(repository.cam.ac.uk)에 사본이 있다고 OpenAlex가 보여 줌 — 이 그룹이 그 저장소를 쓰긴 한다(사실), 그러나 2020 글은 거기 없다(OpenAlex 기준, 직접 확인 아님).
- Cambridge 저장소 검색 API는 curl로 429(요청 과다), 웹 도구로는 'DSpace' 한 단어만 돌아옴. 저장소 직접 검색은 못 함.
- 검색 결과에 Zaccaria 2017 박사 논문 'Bi-tempered glass'(Cambridge)가 참고문헌으로 나옴(검색 요약, 원문 아님). OpenAlex 학위논문 검색에서는 찾지 못함. 2020 글의 정확도 실험이 이 박사 논문에 먼저 있었을 가능성은 추측일 뿐.
판단: 이 빈칸은 출판사 403과 저장소 부재로 막혀 있다. 반증이 아니라 경로의 실패다. 다음 길: Cambridge 저장소를 다른 시간에 직접(429는 일시적일 수 있음), 또는 'Bi-tempered glass' 박사 논문 사본.

2. 평면/원형 편광기 — 교재 원문은 아직 아님, 교육 자료 두 개를 읽음.
- DoITPoMS 'Introduction to Photoelasticity' 중 'Light transmitted by an anisotropic material' 쪽(University of Cambridge, CC BY-NC-SA). 웹 도구 403, curl 200으로 본문 읽음. 이 쪽이 적은 것(내 말로): 직교 편광기 사이에서 투과 세기가 0이 되는 경우는 둘이다 — (가) 한 주응력 방향이 편광기 방향과 나란할 때(소광 위치, 등경선 isoclinic), (나) 광로차가 파장의 정수배일 때. 등색선(isochromatic)은 주응력 차가 같은 곳. 같은 TLP의 다른 쪽(plane.php, circular.php라는 이름은 내 추측)은 404 — 쪽 이름을 몰라 못 읽음.
- K. Ramesh, 'Experiments with Virtual Polariscope, Laboratory Manual'(IIT Madras, 2017, P_Scope 소프트웨어 설명서 발췌, home.iitm.ac.in, curl 200 PDF 39쪽). 읽은 범위: 서문, 2.2~2.4절. 옮긴 것: '원형 편광기 배치에서는 등경선 무늬가 없어지고 등색선만 보인다. 원형 편광기는 1/4 파장판 두 개를 더한다.' 평면 편광기에서는 '전통적 광탄성에서는 암시야만 유효'하고 등경선 이름은 검광자 각도로 붙인다. 서문: 장 전체 등경선이 필요하면 평면 편광기 영상 네 장(0°, 22.5°, 45°, 67.5°)이 필요하다. 교과서가 아니라 소프트웨어 실습서임.

판단(추론): 두 자료 모두 내가 이미 쓴 일반 원리(평면 편광기의 어두운 곳은 응력 0/정수배 광로차 또는 등경선 둘 중 하나, 원형 편광기는 등경선을 없앤다)와 같다. 새로 생긴 것은 출처가 Wikipedia에서 교육 자료 두 개로 바뀐 것과, Ramesh 서문이 말하는 시험법이다: 등경선은 편광기를 돌리면 움직이고(각도마다 다른 영상) 등색선은 그대로다. Eskes 그림 68·69의 가운데 어두운 띠를 가르려면 같은 시편을 다른 편광기 각도로 찍은 사진이 있어야 한다. 석사 논문에서 내가 본 그림은 각 시편에 한 장씩이었다(노트 eskes-2018-thesis-figures 기준). 그러니 '가를 수 없다'는 판단은 그대로이고, 무엇이 있으면 가를 수 있는지가 조금 더 분명해졌다: (1) 편광기 종류 기재, 또는 (2) 다른 각도의 사진, 또는 (3) 1/4 파장판 유무.
- 그림 68(1차)은 비대칭, 69(3차)는 대칭이었다. 등경선이라면 주응력 방향 분포의 대칭을, 응력 0의 띠라면 크기 분포의 대칭을 따를 것이다. 이 차이로 가를 수 있을지는 모르겠다 — 둘 다 같은 대칭을 가질 수 있음(추측). 쓰지 않는다.

출판 판단: 새로 안 것이 '시험에 필요한 조건' 정도라 공개 글 r3을 낼 만큼은 아니다. 출판 미룸.

남은 빈칸: Zaccaria·Overend 원문(Cambridge 저장소 재시도, 박사 논문), 교과서 원문의 편광기 절(Dally·Riley, Frocht 등 — 공개 사본 확인 필요), SCALP 설명서 5.8.2, Goswami·Morse 본문, Aurik 2017, Rammig ±4 MPa와 식(3), Eskes 5 MPa 근거, Eskes 석사 논문 본문에 편광기 기재가 정말 없는지 한 번 더(실험 장 사진 설명).
