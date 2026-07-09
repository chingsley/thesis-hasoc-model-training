from __future__ import annotations

import random
import re
from typing import List, Optional

import pandas as pd


ENGLISH_TOKEN_RE = re.compile(r"^[A-Za-z][A-Za-z'-]*$")


def _english_token_indexes(tokens: List[str]) -> List[int]:
    return [idx for idx, token in enumerate(tokens) if ENGLISH_TOKEN_RE.match(token)]


def eda_transform(text: str, seed: int = 42) -> str:
    random.seed(seed + len(text))
    tokens = text.split()
    if len(tokens) < 3:
        return text
    indexes = _english_token_indexes(tokens)
    if not indexes:
        return text
    action = random.choice(["drop", "swap"])
    if action == "drop":
        drop_index = random.choice(indexes)
        tokens = [token for idx, token in enumerate(tokens) if idx != drop_index]
    else:
        chosen = indexes[:]
        random.shuffle(chosen)
        if len(chosen) >= 2:
            a, b = chosen[:2]
            tokens[a], tokens[b] = tokens[b], tokens[a]
    return " ".join(tokens)


def apply_eda_to_frame(frame: pd.DataFrame, seed: int = 42) -> pd.DataFrame:
    out = frame.copy().reset_index(drop=True)
    out["tweet"] = [eda_transform(text, seed=seed + idx) for idx, text in enumerate(out["tweet"].tolist())]
    if "id" in out.columns:
        out["id"] = out["id"].astype(str) + "_eda"
    if "length" in out.columns:
        out["length"] = out["tweet"].str.len()
    out["augmentation_source"] = "eda"
    return out


def back_translate_hate_rows(
    frame: pd.DataFrame,
    source_lang: str,
    pivot_lang: str = "eng_Latn",
    model_name: str = "facebook/nllb-200-distilled-600M",
    batch_size: int = 8,
) -> pd.DataFrame:
    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    except ImportError as exc:
        raise ImportError("transformers is required for NLLB back-translation") from exc

    lang_code_map = {"igbo": "ibo_Latn", "yoruba": "yor_Latn"}
    if source_lang not in lang_code_map:
        raise ValueError("Unsupported source language for back-translation: {0}".format(source_lang))
    source_code = lang_code_map[source_lang]

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

    def translate_batch(texts: List[str], src_lang: str, tgt_lang: str) -> List[str]:
        tokenizer.src_lang = src_lang
        inputs = tokenizer(texts, return_tensors="pt", padding=True, truncation=True)
        generated = model.generate(
            **inputs,
            forced_bos_token_id=tokenizer.convert_tokens_to_ids(tgt_lang),
            max_length=256,
        )
        return tokenizer.batch_decode(generated, skip_special_tokens=True)

    hate_rows = frame[frame["label"] == "Hate"].copy()
    augmented_texts = []
    texts = hate_rows["tweet"].tolist()
    for start in range(0, len(texts), batch_size):
        chunk = texts[start : start + batch_size]
        pivot = translate_batch(chunk, source_code, pivot_lang)
        roundtrip = translate_batch(pivot, pivot_lang, source_code)
        augmented_texts.extend(roundtrip)

    hate_rows["tweet"] = augmented_texts
    hate_rows["id"] = hate_rows["id"].astype(str) + "_bt"
    hate_rows["augmentation_source"] = "nllb_back_translation"
    hate_rows["length"] = hate_rows["tweet"].str.len()
    return hate_rows


def maybe_augment_training_frame(
    frame: pd.DataFrame,
    language: str,
    enable_back_translation: bool = False,
    enable_eda: bool = False,
) -> pd.DataFrame:
    parts = [frame.copy()]
    if enable_back_translation:
        parts.append(back_translate_hate_rows(frame, source_lang=language))
    if enable_eda:
        hate_subset = frame[frame["label"] == "Hate"].copy()
        parts.append(apply_eda_to_frame(hate_subset))
    return pd.concat(parts, ignore_index=True)
