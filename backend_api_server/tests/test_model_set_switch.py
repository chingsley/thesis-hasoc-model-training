import os
import tempfile
import threading
import time
import unittest
from unittest import mock

from fastapi import HTTPException

from app import db, main
from app.model_service import (
    effective_model_set,
    env_for_key_in_set,
    model_sources,
    set_runtime_model_set,
)
from app.model_set_service import (
    SETTING_KEY,
    ModelSetSwitcher,
    ModelSetSwitchInProgressError,
    ModelSetUnavailableError,
)
from app.schemas import ModelSetSwitchRequest

ORIGINAL = {
    "HF_MODEL_ID_IGBO": "org/igbo",
    "HF_MODEL_ID_YORUBA": "org/yoruba",
    "HF_MODEL_ID_JOINT": "org/joint",
}
MERGED = {
    "HF_MODEL_ID_IGBO_MERGED": "org/igbo-merged",
    "HF_MODEL_ID_YORUBA_MERGED": "org/yoruba-merged",
}


class FakeRouter:
    def __init__(self, model_set):
        self.model_set = model_set


class RecordingBuilder:
    """Stands in for ModelRouter construction; optionally blocks or fails."""

    def __init__(self, fail_for=(), gate=None):
        self.calls = []
        self.fail_for = set(fail_for)
        self.gate = gate

    def __call__(self, model_set):
        self.calls.append(model_set)
        if self.gate is not None:
            self.gate.wait(5)
        if model_set in self.fail_for:
            raise OSError(f"401 for {model_set}")
        return FakeRouter(model_set)


def wait_until_idle(switcher, timeout=5.0):
    deadline = time.monotonic() + timeout
    while switcher.status()["loading"] is not None:
        if time.monotonic() > deadline:
            raise AssertionError("switch did not finish")
        time.sleep(0.01)


class ModelSetTestCase(unittest.TestCase):
    env: dict = {}

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        env = {"DASHBOARD_DB_PATH": os.path.join(self.tmp.name, "test.db"), **self.env}
        patcher = mock.patch.dict(os.environ, env, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        db.reset_conn_for_testing()
        set_runtime_model_set(None)

    def tearDown(self):
        set_runtime_model_set(None)
        db.reset_conn_for_testing()
        self.tmp.cleanup()


class ModelSourceTests(ModelSetTestCase):
    env = {**ORIGINAL, **MERGED, "HF_MODEL_SET": "original"}

    def test_merged_never_falls_back_to_unsuffixed_ids(self):
        self.assertEqual(env_for_key_in_set("merged", "HF_MODEL_ID", "IGBO"), "org/igbo-merged")
        self.assertIsNone(env_for_key_in_set("merged", "HF_MODEL_ID", "JOINT"))
        self.assertEqual(env_for_key_in_set("original", "HF_MODEL_ID", "JOINT"), "org/joint")

    def test_model_sources_per_set(self):
        self.assertEqual(
            model_sources("original"),
            {"igbo": "org/igbo", "yoruba": "org/yoruba", "joint": "org/joint"},
        )
        self.assertEqual(
            model_sources("merged"), {"igbo": "org/igbo-merged", "yoruba": "org/yoruba-merged"}
        )

    def test_legacy_id_is_original_only(self):
        with mock.patch.dict(os.environ, {"HF_MODEL_ID": "org/legacy"}, clear=True):
            self.assertEqual(model_sources("original"), {"igbo": "org/legacy", "yoruba": "org/legacy"})
            self.assertEqual(model_sources("merged"), {})

    def test_runtime_choice_overrides_env(self):
        self.assertEqual(effective_model_set(), "original")
        set_runtime_model_set("merged")
        self.assertEqual(effective_model_set(), "merged")


class SwitcherTests(ModelSetTestCase):
    env = {**ORIGINAL, **MERGED, "HF_MODEL_SET": "original"}

    def test_switch_loads_in_background_then_activates_and_saves(self):
        builder = RecordingBuilder()
        switcher = ModelSetSwitcher(builder)
        self.assertEqual(switcher.router().model_set, "original")

        switcher.start_switch("merged", user_id=7)
        wait_until_idle(switcher)

        self.assertEqual(effective_model_set(), "merged")
        self.assertEqual(switcher.router().model_set, "merged")
        self.assertEqual(db.get_app_setting(SETTING_KEY), "merged")
        self.assertIsNone(switcher.status()["error"])
        self.assertEqual(builder.calls, ["original", "merged"])

    def test_old_models_serve_until_the_new_ones_load(self):
        gate = threading.Event()
        switcher = ModelSetSwitcher(RecordingBuilder())
        old = switcher.router()
        switcher._build_router = RecordingBuilder(gate=gate)

        switcher.start_switch("merged", user_id=7)
        self.assertEqual(switcher.status()["loading"], "merged")
        self.assertIs(switcher.router(), old)
        self.assertEqual(effective_model_set(), "original")
        with self.assertRaises(ModelSetSwitchInProgressError):
            switcher.start_switch("original", user_id=7)

        gate.set()
        wait_until_idle(switcher)
        self.assertEqual(switcher.router().model_set, "merged")

    def test_failed_load_keeps_current_set_and_reports_error(self):
        switcher = ModelSetSwitcher(RecordingBuilder(fail_for={"merged"}))
        switcher.router()

        switcher.start_switch("merged", user_id=7)
        wait_until_idle(switcher)

        self.assertEqual(effective_model_set(), "original")
        self.assertEqual(switcher.router().model_set, "original")
        self.assertIsNone(db.get_app_setting(SETTING_KEY))
        self.assertIn("401 for merged", switcher.status()["error"])

    def test_unconfigured_set_is_rejected_without_loading(self):
        builder = RecordingBuilder()
        switcher = ModelSetSwitcher(builder)
        switcher.router()
        with mock.patch.dict(os.environ, {k: "" for k in MERGED}):
            with self.assertRaises(ModelSetUnavailableError) as ctx:
                switcher.start_switch("merged", user_id=7)
        self.assertIn("HF_MODEL_ID_IGBO_MERGED", str(ctx.exception))
        self.assertEqual(builder.calls, ["original"])

    def test_restore_uses_saved_choice(self):
        db.set_app_setting(SETTING_KEY, "merged", 7)
        switcher = ModelSetSwitcher(RecordingBuilder())
        switcher.restore_saved_choice()
        self.assertEqual(effective_model_set(), "merged")
        self.assertEqual(switcher.router().model_set, "merged")

    def test_restore_falls_back_to_env_when_saved_choice_fails(self):
        db.set_app_setting(SETTING_KEY, "merged", 7)
        switcher = ModelSetSwitcher(RecordingBuilder(fail_for={"merged"}))
        switcher.restore_saved_choice()
        self.assertEqual(effective_model_set(), "original")
        self.assertEqual(switcher.router().model_set, "original")
        self.assertIn("saved choice (merged)", switcher.status()["error"])


class UnsetEnvTests(ModelSetTestCase):
    env = dict(ORIGINAL)

    def test_naming_the_loaded_models_does_not_reload_them(self):
        builder = RecordingBuilder()
        switcher = ModelSetSwitcher(builder)
        self.assertIsNone(switcher.router().model_set)

        switcher.start_switch("original", user_id=7)

        self.assertEqual(builder.calls, [None])
        self.assertEqual(effective_model_set(), "original")
        self.assertIsNone(switcher.status()["loading"])


class EndpointTests(ModelSetTestCase):
    env = {**ORIGINAL, **MERGED, "HF_MODEL_SET": "original", "PLATFORM_ADMIN_EMAILS": "admin@x.org"}

    def setUp(self):
        super().setUp()
        self.switcher = ModelSetSwitcher(RecordingBuilder())
        self.switcher.router()
        patcher = mock.patch.object(main, "model_sets", self.switcher)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_non_admins_get_403(self):
        member = {"id": 2, "email": "user1@test.com"}
        for call in (
            lambda: main.get_model_set(user=member),
            lambda: main.switch_model_set(ModelSetSwitchRequest(model_set="merged"), user=member),
        ):
            with self.assertRaises(HTTPException) as ctx:
                call()
            self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(effective_model_set(), "original")

    def test_admin_switches_and_reads_status(self):
        admin = {"id": 1, "email": "admin@x.org"}
        main.switch_model_set(ModelSetSwitchRequest(model_set="merged"), user=admin)
        wait_until_idle(self.switcher)
        status = main.get_model_set(user=admin)
        self.assertEqual(status.active, "merged")
        self.assertEqual(status.env_default, "original")
        self.assertEqual(status.saved, "merged")
        self.assertEqual([o.configured for o in status.options], [True, True])

    def test_unconfigured_set_returns_422(self):
        admin = {"id": 1, "email": "admin@x.org"}
        with mock.patch.dict(os.environ, {k: "" for k in MERGED}):
            with self.assertRaises(HTTPException) as ctx:
                main.switch_model_set(ModelSetSwitchRequest(model_set="merged"), user=admin)
        self.assertEqual(ctx.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()
