---
language:
- ig
- yo
license: mit
tags:
- hate-speech-detection
- text-classification
- igbo
- yoruba
- multilingual
- xlm-roberta
pipeline_tag: text-classification
library_name: transformers
---

# Afro-XLMR joint Igbo + Yoruba hate speech classifier

Single 3-class model trained on **both** Igbo and Yoruba: **Normal**, **Abuse**, **Hate**.

Fine-tuned from `Davlan/afro-xlmr-base` on the combined dataset.

## Usage

Paste text in the **Inference** widget on this page, or:

```python
from transformers import pipeline
clf = pipeline("text-classification", model="chingsley/afro-xlmr-joint-igbo-yoruba-hate")
clf("your text here", top_k=3)
```

## Labels

| ID | Label  |
|----|--------|
| 0  | Normal |
| 1  | Abuse  |
| 2  | Hate   |
