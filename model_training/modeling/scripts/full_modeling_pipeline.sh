#!/usr/bin/env bash
set -euo pipefail

# Classical + zero-shot baselines per language.
python -m modeling.scripts.run_baselines --lang igbo
python -m modeling.scripts.run_baselines --lang yoruba

# Fine-tune each transformer model on BOTH single languages. We reuse the same
# recipe and flip the language via the --lang override so we do not need to
# duplicate YAML configs.
for CFG in modeling/configs/xlmr_base.yaml \
           modeling/configs/afroxlmr_base.yaml \
           modeling/configs/afriberta_large.yaml; do
    for LANG in igbo yoruba; do
        python -m modeling.scripts.run_finetune --config "${CFG}" --lang "${LANG}"
    done
done

# Joint multilingual fine-tuning (Igbo + Yoruba together).
python -m modeling.scripts.run_finetune --config modeling/configs/joint_igbo_yoruba.yaml

# Cross-lingual transfer: fine-tune on one language, evaluate on the other.
python -m modeling.scripts.run_finetune \
    --config modeling/configs/afroxlmr_base.yaml \
    --train-lang igbo --test-lang yoruba
python -m modeling.scripts.run_finetune \
    --config modeling/configs/afroxlmr_base.yaml \
    --train-lang yoruba --test-lang igbo

# Explainability: LIME, SHAP, attention rollout, and Captum integrated gradients
# on a class-balanced sample of the test set for each single-language run.
for RUN_NAME in xlm_roberta_base afro_xlmr_base afriberta_large; do
    for LANG in igbo yoruba; do
        python -m modeling.scripts.run_explain \
            --latest --run-name "${RUN_NAME}" --lang "${LANG}" --num-rows 12 \
            || echo "WARN: explanation step failed for ${RUN_NAME}/${LANG} (continuing)"
    done
done

# Rebuild the aggregate markdown report (metrics + explainability) from all runs/ artefacts.
python -m modeling.scripts.run_eval --aggregate-only
