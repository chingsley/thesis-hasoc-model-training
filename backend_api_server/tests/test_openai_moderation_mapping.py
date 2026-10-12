import unittest

from app.openai_moderation_service import map_moderation_result_to_hasoc


class OpenAiModerationMappingTests(unittest.TestCase):
    def test_mostly_clean_maps_to_normal(self) -> None:
        out = map_moderation_result_to_hasoc(
            {"hate": 0.01, "harassment": 0.02, "violence": 0.01},
            categories={"hate": False, "harassment": False},
        )
        self.assertEqual(out["predicted_label"], "Normal")
        probs = out["probabilities"]
        self.assertAlmostEqual(probs["normal"] + probs["abuse"] + probs["hate"], 1.0, places=5)
        self.assertGreater(probs["normal"], probs["abuse"])
        self.assertGreater(probs["normal"], probs["hate"])

    def test_high_hate_maps_to_hate(self) -> None:
        out = map_moderation_result_to_hasoc(
            {"hate": 0.92, "hate/threatening": 0.88, "harassment": 0.1},
            categories={"hate": True, "harassment": False},
        )
        self.assertEqual(out["predicted_label"], "Hate")
        self.assertGreater(out["probabilities"]["hate"], out["probabilities"]["abuse"])

    def test_harassment_without_hate_maps_to_abuse(self) -> None:
        out = map_moderation_result_to_hasoc(
            {"hate": 0.02, "harassment": 0.85, "violence": 0.4},
            categories={"hate": False, "harassment": True},
        )
        self.assertEqual(out["predicted_label"], "Abuse")
        self.assertGreater(out["probabilities"]["abuse"], out["probabilities"]["hate"])

    def test_co_flagged_hate_wins_over_higher_harassment_score(self) -> None:
        """Regression: anti-immigrant line — OpenAI hate=true but harassment/threatening score higher."""
        scores = {
            "harassment": 0.9812214345234632,
            "harassment/threatening": 0.9939024819135036,
            "hate": 0.883781313296962,
            "hate/threatening": 0.022759758266854748,
            "violence": 0.023499219062398675,
        }
        categories = {
            "hate": True,
            "hate/threatening": False,
            "harassment": True,
            "harassment/threatening": True,
        }
        out = map_moderation_result_to_hasoc(scores, categories)
        self.assertEqual(out["predicted_label"], "Hate")
        self.assertGreater(out["probabilities"]["hate"], out["probabilities"]["abuse"])


if __name__ == "__main__":
    unittest.main()
