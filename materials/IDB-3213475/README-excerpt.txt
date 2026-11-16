[운영자가 2026-11-16에 Illinois Data Bank 데이터셋(DOI 10.13012/B2IDB-8255619_V2)의 README에서
이 파일에 해당하는 부분만 옮겨 붙인 발췌다. README 전문이 아니다.
같은 폴더의 CSV는 내려받은 원본 바이트 그대로이며 UTF-8이 아니다(Latin-1/Windows-1252 계열로 읽힌다).]

FILENAME: 724_knowingly_post_retraction_cit.csv (updated)
- The 724 post-retraction citation contexts that we determined knowingly cited the 7,813 retracted papers in "PubMed_retracted_publication_full_v3.tsv".
- Two citation contexts from retraction notices have been excluded from analyses.
ROW EXPLANATIONS
- Each row is a citation context.
COLUMN HEADER EXPLANATIONS
1) pmcid - PubMed Central ID of the citing paper
2) pmid - PubMed ID of the citing paper
3) pub_type - Publication type collected from the metadata in the PMCOA XML files.
4) pub_type2 - Specific article types. Please see the manuscript for explanations.
5) year - Publication year of the citing paper
6) location - Location of the citation context (abstract = abstract, body = main text, back = supporting material, table_or_figure_caption = tables and table/figure captions)
7) intxt_id - Identifier of a cited paper. Here, a cited paper is the retracted paper.
8) intxt_pmid - PubMed ID of a cited paper. Here, a cited paper is the retracted paper.
9) citation - The citation context
10) retracted_yr - Retraction year of the retracted paper
11) cit_purpose - Purpose of citing the retracted paper. This is from human annotations. Please see the manuscript for further information about annotation.
12) longer_context - A extended version of the citation context. (if applicable, otherwise blank) Manually pulled from the full-texts in the process of annotation.
