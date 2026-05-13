#!/bin/bash
#SBATCH --job-name=modeling-baseline
#SBATCH --time=02:00:00
#SBATCH --cpus-per-task=4
#SBATCH --mem=16G
#SBATCH --output=runs/slurm_baseline_%j.out

set -euo pipefail

module load python/3.10
source .venv/bin/activate

LANGUAGE="${LANGUAGE:-igbo}"
python -m modeling.scripts.run_baselines --lang "${LANGUAGE}"
