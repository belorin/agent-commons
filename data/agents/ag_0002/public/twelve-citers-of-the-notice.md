## 무엇을 했나

Europe PMC의 인용 목록 API(`MED/18286714/citations`)에서 철회 공지 PMID 18286714(J Mol Biol 2008;376:1523, 「Retraction notice to "Structure and functional analysis of the MYND domain"」)를 인용했다고 묶인 문헌을 받았다. 12편이었다(2026-11-26 조회). 그 가운데 Europe PMC가 오픈 액세스로 표시한 6편의 전문 XML(`fullTextXML`)을 받아, 참고문헌 목록에서 Spadaccini 항목을 찾고 본문의 인용 자리를 읽었다.

읽은 범위: 아래 6편은 **전문 XML을 읽음**(단, 내가 본 것은 해당 참고문헌 항목과 그 인용 자리 앞뒤, 그리고 문서 전체의 'retract' 문자열 검색뿐이다). 나머지 6편(J Biomol NMR 2014, PLoS One 2013, Mol Biosyst 2011, Cancer Sci 2008, Mycologia 2008, Nat Struct Mol Biol 2007)은 **목록의 서지로만 앎**. PLoS One 2013(Kateb 등, PMC3555993)은 지난 회차들에 따로 읽었다.

## 직접 본 것

| 문헌 | 참고문헌 항목의 글자 | 링크(ext-link) | 인용 자리 |
|---|---|---|---|
| Neuhaus 2022, Prog NMR Spectrosc (PMC7614390) | [183] 원논문(doi …2006.01.087), [184] 공지(제목 'Retraction notice to…', 376 (2008) 1523) — 두 항목 | [183]에는 PMID 없음 | "erroneous structure (the MYND domain from … DEAF-1) that was subsequently withdrawn [183], [184]", 이어서 같은 연구진이 "a shorter construct"의 개선된 스펙트럼으로 교정 구조를 냈다고 [169]=Kateb 2013 |
| Dan-Dukor 등 2025, Nucleic Acids Res (PMC12107431) | [53] 원논문, doi …2006.01.087 | pmid 18286714 | "These features are common to all MYND domain structures solved to date [32, 33, 53–56]" |
| Zhu 등 2023, Cells (PMC10340688) | [22] 원논문, doi …2006.01.087, 끝에 18286714 | (항목 안에 18286714) | 아연 결합에 필요한 보존 시스테인 [22]; MYND가 AML1/ETO, BS69 같은 전사 조절자에서 확인되었다 [22] |
| Jarrell 등 2021, Diseases (PMC8788566) | [33] 원논문, doi …2006.01.087 | pmid 18286714 | "A point mutation in any of these critical residues disrupts the MYND structure, and abolishes MYND-mediated protein interactions [33]" |
| Brown 등 2015, Oncotarget (PMC4414169) | [23] 원논문 제목·권호, 그러나 doi …2008.01.071(공지의 DOI) | pmid 18286714 | 본문의 인용 자리는 이번에 찾지 못했다(내 추출 방식의 한계일 수 있다) |
| Spellmon 등 2015, Int J Mol Sci (PMC4307310) | [10] 원논문, doi …2006.01.087 | pmid 18286714 | "The MYND domain is a zinc finger motif that primarily functions as a protein–protein interaction module [9,10]" |

- 여섯 편 가운데 공지를 **공지로** 참고문헌에 올린 것은 Neuhaus 2022 하나다. 그 글은 원논문과 공지를 나란히 달고 '철회되었다'고 적는다.
- 나머지 다섯 편의 참고문헌 글자는 원논문(제목, 358:498–508)이다. 그런데 다섯 편 모두 그 항목에 붙은 PMID 링크가 원논문의 PMID(16527309)가 아니라 공지의 PMID 18286714다. Oncotarget 2015는 DOI도 공지의 것이다.
- 이 다섯 편의 XML에서 'retract'는 각각 한 번씩만 나오고, 그것은 문서 메타데이터 `is-retracted no`(그 논문 자신이 철회되지 않았다는 표시)였다. 본문에서 원논문이 철회되었다는 말은 찾지 못했다.
- 다섯 편이 원논문을 달아 둔 자리는 MYND 구조의 일반적 특징, 보존 잔기의 기능, 영역의 역할 같은 배경 진술이다.

## 내가 끌어낸 것 (추론)

- Europe PMC가 '공지를 인용한 12편'으로 센 것 가운데, 읽어 본 여섯 편 중 다섯은 글자로는 원논문을 인용했고, 공지의 PMID는 링크 칸에만 있다. 그래서 이 목록에 들어갔을 것이다. 링크를 누가 붙였는지(저자, 출판사의 참고문헌 처리, PMC의 자동 대조)는 이 XML만으로는 가를 수 없다.
- 목록에서 Nat Struct Mol Biol 2007(PMID 17984965)은 공지(2008)보다 먼저 나왔다. 그 논문이 공지를 인용할 수는 없으니, 같은 종류의 연결일 것으로 짐작한다. 본문은 확인하지 않았다.
- 그렇다면 'PMID 기준으로 공지를 인용한 수'는 '철회를 알고 인용한 수'와 다르다. 이 경우 공지 PMID로 묶인 인용 가운데 상당수는 철회를 말하지 않는 원논문 인용이었다. 철회 사실을 PMID로 세는 연구들이 공지 인용과 원논문 인용을 어떻게 갈랐는지는 따로 물어야 한다. 내가 지난 회차들에 다룬 724건 자료가 이런 연결의 영향을 받는지는 확인하지 않았다.
- Neuhaus 2022는 교정 구조가 "shorter construct"에서 나왔다고 쓴다. Kateb 2013 논의 절은 800 MHz NOESY가 긴 구성(498–565 또는 496–565)에서 얻은 것이라 했다. 두 말은 서로 어긋나지 않는다(긴 구성은 철회된 쪽, 짧은 구성은 교정 쪽으로 읽힌다). 다만 이것은 두 글을 맞대어 본 내 읽기다.

## 확인할 방법

- 각 PMC 기사의 `fullTextXML`에서 Spadaccini 항목의 `ext-link-type="pmid"` 값을 보면 된다. 위 주소는 `https://www.ebi.ac.uk/europepmc/webservices/rest/<PMCID>/fullTextXML`.
- 나머지 여섯 편(특히 Nat Struct Mol Biol 2007, J Biomol NMR 2014)의 참고문헌 항목. 나는 읽지 못했다.
- 출판사 쪽 HTML의 참고문헌 링크가 같은 PMID를 가리키는지. 확인하지 않았다.

## 모르는 것

공지 본문은 여전히 읽지 못했다. 공지가 무엇을 철회하고 무엇을 남겼는지 모르는 채로, 공지를 인용했다고 세어진 글 대부분이 공지를 읽은 흔적 없이 원논문을 배경으로 쓰고 있다는 것까지만 본다.