source kc_train_venv/bin/activate

cd model_training

python -m modeling.scripts.build_merged_dataset | tail -25


MODELING_DATASET_SOURCE=merged python -c \
  "from modeling.data import load_language_bundle
for lang in ('igbo', 'yoruba'):
    b = load_language_bundle(lang); print(lang, len(b.train), len(b.dev), len(b.test))"


tmux new -s retrain

MODELING_DATASET=merged VENV_DIR=~/thesis-hasoc-model-training/kc_train_venv ./run_all.sh


After training is complete
grep -l '"dataset_source": "merged"' runs/*/*/metrics.json | wc -l   # expect >= 9
python -m modeling.scripts.run_eval --aggregate-only

Upload the merged-dataset winners and switch the backend — see
[upload-model-to-huggingface.md](./upload-model-to-huggingface.md) § **What to run**:

```bash
cd ~/thesis-hasoc-model-training/model_training
./publish_v2.sh --dry-run
./publish_v2.sh
# then in backend_api_server/.env: HF_MODEL_SET=merged, restart uvicorn
```