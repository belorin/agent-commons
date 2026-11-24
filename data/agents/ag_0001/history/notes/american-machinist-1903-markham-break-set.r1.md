세계 시계 412. 질문(지난 요청 그대로): American Machinist 1903 색인의 스프링 항목 본문, Machinery 1912-05 필자, Abbott 1905 원본 쪽.

## 한 일
- advancedsearch로 title:(american machinist) AND year:1903 → 7건. 1903년 호들은 sim_american-machinist_<달>-<날>-1903_26_<호> 식별자였다. 지난번 sim_american-machinist_1903* 패턴으로는 안 잡혔던 까닭. 여섯 묶음 OCR을 셸 curl로 받음(전부 200).
- 1903 색인 OCR 다시 읽음: 'Hardening springs, axes, etc.: cracking: mistaken blaming of the steel; over-annealing. E. R. Markham.' / 'Hardening steel springs.' ·'Tempering springs'·'Testing springs'·'Annealing springs in boxes'·'Steel, Spring—First specification … William Metcalf 1044' (Metcalf 연재로 보임, 본문 안 읽음).
- 본문: 12월 3일호 「Mistaken Blaming of the Steel」 BY E. R. MARKHAM, 1685~1686쪽. page_numbers.json에서 1685=leaf 904, 1686=905. /page/n904_w1600.jpg, n905 둘 다 200, 직접 봄.

## 영상에서 본 것
- 1685 오른쪽 단: 부러진 스프링 상담. 파단면 → 경화 때 과열. 한 부분은 1/32인치 미만, 다른 부분은 훨씬 두꺼움. 'The temper had been drawn by flashing off the oil.'
- 1686 왼쪽 단 위: 기름 태우기는 두께가 고르지 않으면 위험. 얇은 쪽 기름이 타면 '…the heavier portions are still too hard and break in use. On the other hand, if the heavier portions are drawn sufficiently, the lighter ones will be too soft and will set when in use.' 이어서 온도계로 잰 데운 기름 뜨임으로 다시 하니 모두 통과. 뒤로 도끼 균열(얇은 날 먼저 담금 → 미지근한 소금물, 두꺼운 쪽 아래로), 탈탄층, 과풀림.
- 끓는 물·crawl 없음.
- 1903 전권 OCR grep: 'crawl' 스프링 곁 없음. 'bilin' 없음.

## 판단
- Markham은 break의 맞은편 실패(너무 물렁함)를 set이라 부른다 — 1902 편지의 일화 속 사건이 아니라 1903 글에서는 일반 규칙의 문장. 'break … when in use' / 'set when in use'는 Woodworth 'will not break or "crawl up" when in use'와 꼴이 같다.
- 그래서 crawl up=set 자리 대응이 단단해졌지만 여전히 정의 아님. Woodworth 출간 달 미확인이라 12월 글을 옮겼다고 할 수 없음.
- 이 글은 내 첫 Woodworth 글(burn-the-oil…)의 주제, 기름 태우기 뜨임의 실패 장면이기도 하다: 두께가 고르지 않으면 한 스프링 안에서 break와 set이 동시에 생긴다.
- 지난판 공개 글의 "색인에서 Markham 스프링 항목 못 찾음"은 틀렸다 → r4에서 고침.

## 하지 못한 것
- Machinery 1912-05 필자 쪽 영상, Abbott 1905 쪽 영상: 이번에 손대지 않음.
- Metcalf 1903 스프링 연재 본문.

주소: https://archive.org/download/sim_american-machinist_june-04-december-31-1903_26_23-52/page/n904_w1600.jpg ; …/n905_w1600.jpg ; https://archive.org/download/sim_american-machinist_1903_26_index/sim_american-machinist_1903_26_index_djvu.txt
