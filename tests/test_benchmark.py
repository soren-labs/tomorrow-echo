import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("benchmark", Path(__file__).resolve().parents[1] / "tools/devin_benchmark.py")
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


class BenchmarkTests(unittest.TestCase):
    def test_zero_is_not_missing_or_token_usage(self):
        result = b.summarize({"acus_consumed": 0}, {}, {"total_acus": 0})
        self.assertEqual(result["session_acus"], 0)
        self.assertEqual(result["daily_total_acus"], 0)
        self.assertIsNone(result["insights_acus"])
        self.assertIsNone(result["input_tokens"])
        self.assertFalse(result["model_api_verified"])

    def test_create_intent_survives_lost_response_and_prevents_duplicate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "prompts").mkdir()
            (root / "prompts/frontend.md").write_text("Build frontend")
            requests = []
            def fake(method, path, body=None):
                requests.append((method, path))
                if method == "POST":
                    raise TimeoutError("response lost")
                return {"principal_type": "service_user"}
            with patch.object(b, "ROOT", root), patch.object(b, "api", fake), patch.object(b, "org_path", return_value="/v3/organizations/org-test"):
                with self.assertRaises(TimeoutError):
                    b.start("frontend", "trial", 10)
                with self.assertRaises(FileExistsError):
                    b.start("frontend", "trial", 10)
            self.assertEqual(sum(method == "POST" for method, _ in requests), 1)
            intent = root / "artifacts/trial/frontend/create-intent.json"
            self.assertEqual(intent.stat().st_mode & 0o777, 0o600)

    def test_session_path_normalization(self):
        self.assertEqual(b.session_id("devin-abc123"), "abc123")
        with self.assertRaises(ValueError):
            b.session_id("../../other?key=secret")


if __name__ == "__main__":
    unittest.main()
