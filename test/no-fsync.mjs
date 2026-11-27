// 시험 전용: 임시 루트에 쓰는 시험 프로세스에서 fsync 를 건너뛴다(전원 차단 내구성은 시험이 관찰할 수 없다).
// 실행기 코드는 그대로이며, 실제 회차·CLI 에서는 이 파일을 불러오지 않는다. package.json 의 test 스크립트만 --import 한다.
import fs from 'node:fs';
fs.fsyncSync = () => {};
