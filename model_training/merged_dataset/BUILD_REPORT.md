# Merged dataset build report

Seed 42, dev 10%, test 10% (of new data).

## igbo

### New data cleaning
- raw rows: 7086 (`igbo_dataset_labeled.csv`)
- dropped duplicate groups with conflicting labels: 31 rows across 6 texts
- dropped exact duplicate tweets: 116
- clean rows kept: 6939
- label distribution: Normal 6627 (95.5%), Abuse 116 (1.7%), Hate 196 (2.8%)

### Splits written
- `igbo_train.csv`: 5551 rows — Normal 5301 (95.5%), Abuse 93 (1.7%), Hate 157 (2.8%)
- `igbo_dev.csv`: 694 rows — Normal 663 (95.5%), Abuse 11 (1.6%), Hate 20 (2.9%)
- `igbo_test.csv`: 694 rows — Normal 663 (95.5%), Abuse 12 (1.7%), Hate 19 (2.7%)

### Merged root
- merged train: 8539 rows — Normal 6053 (70.9%), Abuse 2173 (25.4%), Hate 313 (3.7%)
- merged dev/test: 667/717 rows (exact copies of the original benchmark)

### Verification
- verification OK: loaders accept both roots; dev/test identical to original; zero leakage of new train into the benchmark; merged train = 2988 + 5551 rows

## yoruba

### New data cleaning
- raw rows: 15000 (`yoruba_dataset_labeled.csv`)
- dropped rows with unsupported labels: {'Invalid': 150}
- dropped exact duplicate tweets: 17
- clean rows kept: 14833
- label distribution: Normal 10303 (69.5%), Abuse 4061 (27.4%), Hate 469 (3.2%)

### Splits written
- `yoruba_train.csv`: 11866 rows — Normal 8242 (69.5%), Abuse 3249 (27.4%), Hate 375 (3.2%)
- `yoruba_dev.csv`: 1483 rows — Normal 1030 (69.5%), Abuse 406 (27.4%), Hate 47 (3.2%)
- `yoruba_test.csv`: 1484 rows — Normal 1031 (69.5%), Abuse 406 (27.4%), Hate 47 (3.2%)

### Merged root
- merged train: 15194 rows — Normal 9660 (63.6%), Abuse 5057 (33.3%), Hate 477 (3.1%)
- merged dev/test: 722/817 rows (exact copies of the original benchmark)

### Verification
- verification OK: loaders accept both roots; dev/test identical to original; zero leakage of new train into the benchmark; merged train = 3328 + 11866 rows

