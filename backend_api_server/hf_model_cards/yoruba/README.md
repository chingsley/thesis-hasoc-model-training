---
language:
- yo
license: mit
tags:
- hate-speech-detection
- text-classification
- yoruba
- xlm-roberta
pipeline_tag: text-classification
library_name: transformers
---

# Afro-XLMR Yoruba hate speech classifier

3-class classifier for Yoruba social media text: **Normal**, **Abuse**, **Hate**.

Fine-tuned from `Davlan/afro-xlmr-base` on the HASOC Yoruba hate speech dataset.

## Usage

Paste text in the **Inference** widget on this page, or:

```python
from transformers import pipeline
clf = pipeline("text-classification", model="chingsley/afro-xlmr-yoruba-hate")
clf("your yoruba text here", top_k=3)
```

## Labels

| ID | Label  |
|----|--------|
| 0  | Normal |
| 1  | Abuse  |
| 2  | Hate   |
