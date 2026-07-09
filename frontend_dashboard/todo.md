### Step 4.2: Frontend Development

As a user

1. I can choose a language (Igbo or Yoruba) to switch to the dashboard for the selected language.
2. I can view in the dashboard stats about processed posts
   - Stats of post analysed (these are only sample numbers):
     - 3000 posts processed
     - 2200 Normal posts
     - 600 Abusive posts
     - 200 Hateful posts
3. Flagging/Triage Queue with Status: I can click each hate type/category above to view the posts flagged under each category. Hate and Abusive Posts move through New → Reviewed → Reported. Tracks which flagged posts have been sent to authorities. I can click on a button to flag any of the hate posts from (3). Each hate post will have a associated “flag” button. If post is flagged, it’ll be reported to authorities
4. Side-by-side explanation comparison — show LIME vs SHAP vs Attention Rollout for the same post so operators can cross-validate why a post was flagged
5. Explanation confidence meter — display the fidelity/faithfulness score of each explanation (e.g., LIME's fidelity_proxy alongside SHAP stability). Warns when highlights may be unreliable.
6. Model Confidence Threshold Slider: Let the analyst move a slider from 0–1 to filter posts by Hate probability. Lowering it catches more borderline cases; raising it reduces false alarms. Directly supports operational tuning.
   - Display model's probability (0–100%) alongside each prediction. 
7. I can paste a text in an input box to test it’s toxicity score (harmless, abusive, hate)
8. I can View the text displayed with toxic parts highlighted in certain chosen colour (EXPLAINABILITY)
9. Batch/Bulk Text Scanner: Upload a CSV of posts and get all classified with downloadable results. Useful for triaging large dumps of evidence during an investigation.
10. Trigger pop-up alerts when a post crosses the Hate probability threshold. Gives the analyst live situational awareness of active hate campaigns.
11. Display accuracy, precision, recall, F1 per class (Normal/Abuse/Hate), and the confusion matrix. Your evaluate.py already computes these — shows the analyst where the model fails.
12. Toxic Term Word Cloud: Use LIME/SHAP token scores (already in explain.py) to build a live word cloud of the most toxic-attributed words. Hovering a word shows example posts containing it — helps identify emerging hate terms.
13. Model Drift / Performance-over-Time Monitor: Log prediction confidence distribution over time. If average confidence shifts, it signals the model may be going stale and needs retraining — important for long-term deployment. OR Compare recent prediction distributions (Normal/Abuse/Hate ratios) against training data baselines. If real-world posts shift significantly, the model may need retraining — warn the expert before accuracy silently degrades.
14. Borderline Post Review Queue: Show posts where the model is uncertain (e.g., 40–60% Hate vs Abuse). These are posts the model struggles with most — reviewing them improves both the model and detection accuracy over time.
15. Export Incident Report: Generate a one-click PDF/CSV report of all flagged hate posts within a date range, including post text, predicted label, confidence, hate target category, and toxic highlights — ready to share with authorities.
16. Post Volume Spike Alert: Track posts per hour by predicted label. If Hate-labeled posts suddenly spike (e.g., after a political event), trigger an alert. Your data pipeline already processes batches — add a simple rate-of-change check.
17. Similar Post Cluster Detection to detect coordinated attack: Use model embeddings (from your transformer's last hidden layer) to group semantically similar hate posts. Helps identify coordinated hate campaigns or copycat posts spreading the same message.

- Analyse the codebase to understand the existing code and its purpose
- Using the features above, adapt the dashboard in the screenshot (screenshots/sample_dashboard_design_026-07-09_3.57.31.png) to implement the above listed features.
  Stack:

* Build Tool & Bundler: Vite
* Data Fetching & Caching: TanStack Query (React Query)
* UI Framework & Styling: Shadcn/ui + Tailwind CSS
* Client-Side Routing: React Router
* Charts & Visualizations: Recharts or Tremor
* Local State Management: Zustand (If needed)

- Use dummy data in the frontend API layer for now. This will be replaced by actual calls to the api in the 2nd phase when the backend_api_server will be implemented.
