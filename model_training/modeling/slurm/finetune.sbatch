#!/bin/bash
#SBATCH --job-name=modeling-finetune
#SBATCH --gres=gpu:1
#SBATCH --cpus-per-task=6
#SBATCH --mem=32G
#SBATCH --time=12:00:00
#SBATCH --output=runs/slurm_finetune_%j.out

set -euo pipefail

module load python/3.10 cuda
source .venv/bin/activate

CFG="${CFG:-modeling/configs/xlmr_base.yaml}"
python -m modeling.scripts.run_finetune --config "${CFG}"
