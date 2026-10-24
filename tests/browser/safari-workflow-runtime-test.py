import importlib.util
import json
import socket
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest.mock import Mock, patch


spec = importlib.util.spec_from_file_location(
    "safari_workflow_runtime_test_target",
    Path(__file__).with_name("safari-workflow.py"),
)
workflow = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = workflow
spec.loader.exec_module(workflow)
REAL_SESSION = workflow.Session
REAL_CHECKPOINT_REVIEWS = {
    "design-guidelines": workflow.run_design_guidelines_review,
    "editor-workflow": workflow.run_editor_review,
    "responsive-text": workflow.run_responsive_text_review,
}


def case_result(stage, index):
    result = {"stage": stage, "case": index}
    if stage in workflow.CASE_KEY_FIELDS:
        result.update(zip(workflow.CASE_KEY_FIELDS[stage], workflow.EXPECTED_CASE_KEYS[stage][index]))
    return result


class FakeDriver:
    def __init__(self, pid, *, force_kill=False):
        self.pid = pid
        self.returncode = None
        self.force_kill = force_kill
        self.signals = []

    def poll(self):
        return self.returncode

    def terminate(self):
        self.signals.append("terminate")
        if not self.force_kill:
            self.returncode = 0

    def wait(self, timeout):
        if self.returncode is None:
            raise subprocess.TimeoutExpired("owned-safaridriver", timeout)
        return self.returncode

    def kill(self):
        self.signals.append("kill")
        self.returncode = -9


class WorkflowRuntimeTests(unittest.TestCase):
    def fixture(self, *, authorized=False, arguments=None, effects=None,
                close_error=None, fingerprint_change=False,
                start_error=None, force_kill=False, promo=False):
        temporary = tempfile.TemporaryDirectory(prefix="graph-editor-safari-runtime-test-")
        self.addCleanup(temporary.cleanup)
        output = Path(temporary.name)
        if authorized:
            (output / "native-activation-request.json").write_text(json.dumps({
                "action": "restart-and-activate-safari-for-78-case-review",
            }))
        if promo:
            (output / "promo-request.json").write_text(json.dumps({"scenario": "app-introduction"}))
        drivers = []
        sessions = []
        calls = Counter()
        snapshots = []
        stage_effects = {name: list(values) for name, values in (effects or {}).items()}
        mutated = [False]

        def start_driver():
            if start_error is not None:
                raise start_error
            if (output / "results.json").exists():
                snapshots.append(json.loads((output / "results.json").read_text()))
            driver = FakeDriver(1000 + len(drivers), force_kill=force_kill)
            drivers.append(driver)
            return driver

        class FakeSession:
            def __init__(self):
                self.capabilities = {"browserName": "safari", "mock": True}
                self.navigations = []
                self.restarts = 0
                self.closes = 0
                sessions.append(self)

            def navigate(self, path):
                self.navigations.append(path)
                if path != "/":
                    raise AssertionError("Only the approved initial path is expected")

            def wait(self, script):
                return True

            def restart(self):
                self.restarts += 1

            def close(self):
                self.closes += 1
                if close_error is not None:
                    raise close_error

            def js(self, script):
                return {"mock": True}

            def screenshot(self, name):
                return None

        def review(name):
            def run(session):
                calls[name] += 1
                current = json.loads((output / "results.json").read_text())
                snapshots.append(current)
                if stage_effects.get(name):
                    outcome = stage_effects[name].pop(0)
                    if isinstance(outcome, Exception):
                        raise outcome
                    if isinstance(outcome, int):
                        return [case_result(name, index) for index in range(outcome)]
                if fingerprint_change:
                    mutated[0] = True
                return [case_result(name, index)
                        for index in range(workflow.EXPECTED_STAGE_CASES[name])]
            return run

        restart = Mock(return_value={"status": "restarted", "exitConfirmed": True, "opened": True})
        utilities = {name: Mock() for name in ("run_promo_recording", "run_self_loop_review", "run_text_weight_review")}
        replacements = {
            "OUTPUT": output,
            "Session": FakeSession,
            "_start_driver": start_driver,
            "_wait_driver": Mock(),
            "restart_safari": restart,
            "policy_checks": Mock(),
            "runtime_policy_checks": Mock(),
            "run_feedback_preflight": Mock(return_value=[{"stage": "feedback-preflight", "case": 0}]),
            "review_fingerprint": lambda: ("e" if mutated[0] else "f") * 64,
            "FOCUS_RECOVERIES": [],
            "STORAGE_PROBES": [],
            **utilities,
        }
        function_names = {
            "design-guidelines": "run_design_guidelines_review",
            "editor-workflow": "run_editor_review",
            "enlarged-routing": "run_enlarged_routing_review",
            "responsive-text": "run_responsive_text_review",
            "multi-selection": "run_multi_selection_review",
            "range-menu": "run_range_menu_review",
            "edge-routing": "run_edge_routing_regression",
            "range-selection": "run_range_selection",
            "rust-compute": "run_rust_compute_review",
        }
        replacements.update({function_names[name]: review(name) for name in function_names})
        for name, value in replacements.items():
            entry = patch.object(workflow, name, value)
            entry.start()
            self.addCleanup(entry.stop)
        argv_patch = patch.object(sys, "argv", ["safari-workflow.py", *(arguments or [])])
        argv_patch.start()
        self.addCleanup(argv_patch.stop)
        return {"output": output, "drivers": drivers, "sessions": sessions,
                "calls": calls, "restart": restart, "snapshots": snapshots,
                "utilities": utilities}

    def read(self, fixture, name):
        return json.loads((fixture["output"] / name).read_text())

    def test_success_keeps_all_78_cases_and_requires_cleanup(self):
        fixture = self.fixture()
        workflow.main()
        summary = self.read(fixture, "results.json")
        cleanup = self.read(fixture, "cleanup.json")
        self.assertEqual(summary["status"], "passed")
        self.assertEqual(len(summary["results"]), 78)
        self.assertEqual(summary["feedbackPreflight"]["status"], "passed")
        self.assertTrue(all(row.get("stage") != "feedback-preflight" for row in summary["results"]))
        self.assertEqual(summary["completedStages"], [
            {"name": name, "cases": count} for name, count in workflow.EXPECTED_STAGE_CASES.items()
        ])
        self.assertEqual(summary["sourceFingerprint"], "f" * 64)
        self.assertEqual(summary["driverRecoveries"], [])
        self.assertEqual(summary["browserRestarts"], [])
        self.assertEqual(cleanup["method"], "webdriver")
        self.assertTrue(cleanup["sessionClosed"] and cleanup["driverStopped"])
        self.assertEqual(cleanup["runId"], summary["runId"])
        self.assertEqual(fixture["snapshots"][0]["results"], [])
        self.assertEqual(fixture["drivers"][0].signals, ["terminate"])
        fixture["restart"].assert_not_called()

    def test_authorized_timeout_preserves_completed_stages(self):
        fixture = self.fixture(authorized=True, effects={
            "editor-workflow": [workflow.DriverTimeoutError("read timed out")],
        })
        workflow.main()
        summary = self.read(fixture, "results.json")
        self.assertEqual(summary["status"], "passed")
        self.assertEqual(fixture["calls"]["design-guidelines"], 1)
        self.assertEqual(fixture["calls"]["editor-workflow"], 2)
        self.assertEqual(len(fixture["drivers"]), 2)
        self.assertEqual(fixture["restart"].call_count, 2)
        self.assertFalse((fixture["output"] / "native-activation-request.json").exists())
        self.assertEqual(len(summary["results"]), 78)
        self.assertEqual(sum(item["stage"] == "design-guidelines" for item in summary["results"]), 12)
        self.assertEqual(len(summary["driverRecoveries"]), 1)
        self.assertEqual(summary["driverRecoveries"][0]["stage"], "editor-workflow")
        self.assertEqual({snapshot["runId"] for snapshot in fixture["snapshots"]}, {summary["runId"]})
        self.assertTrue(all(session.navigations == ["/"] for session in fixture["sessions"]))

    def test_checkpointed_cases_resume_once_and_reset_timeout_budget_only_on_progress(self):
        fixture = self.fixture(authorized=True)
        visits = Counter()
        timeouts = Counter()

        def review(stage):
            def run(session):
                results = workflow.CASE_RESULTS.setdefault(stage, [])
                for index in range(workflow.EXPECTED_STAGE_CASES[stage]):
                    case = case_result(stage, index)
                    if workflow._case_completed(stage, case):
                        continue
                    visits[(stage, index)] += 1
                    if timeouts[(stage, index)] < 2:
                        timeouts[(stage, index)] += 1
                        raise workflow.DriverTimeoutError(f"timeout before {stage} case {index}")
                    results.append(case)
                return results
            return run

        with patch.object(workflow, "run_design_guidelines_review", review("design-guidelines")), patch.object(
            workflow, "run_editor_review", review("editor-workflow"),
        ), patch.object(workflow, "run_responsive_text_review", review("responsive-text")), patch("builtins.print"):
            workflow.main()
        summary = self.read(fixture, "results.json")
        self.assertEqual(summary["status"], "passed")
        self.assertEqual(len(summary["results"]), 78)
        self.assertEqual(len(visits), 54)
        self.assertEqual(set(visits.values()), {3})
        for stage in workflow.CASE_KEY_FIELDS:
            actual = [row for row in summary["results"] if row["stage"] == stage]
            self.assertEqual(workflow._case_keys(stage, actual), workflow.EXPECTED_CASE_KEYS[stage])
            recoveries = [row for row in summary["driverRecoveries"] if row["stage"] == stage]
            self.assertEqual(len(recoveries), 2 * workflow.EXPECTED_STAGE_CASES[stage])
            self.assertEqual(max(row["consecutiveTimeouts"] for row in recoveries), 2)
            self.assertTrue(all(row["status"] == "retrying-incomplete-cases" for row in recoveries))
        self.assertEqual({snapshot["runId"] for snapshot in fixture["snapshots"]}, {summary["runId"]})
        self.assertTrue(self.read(fixture, "cleanup.json")["sessionClosed"])

    def test_checkpoint_no_progress_stops_after_three_timeouts_on_the_same_case(self):
        fixture = self.fixture(authorized=True)
        attempts = []

        def run(session):
            results = workflow.CASE_RESULTS.setdefault("design-guidelines", [])
            if not results:
                results.append(case_result("design-guidelines", 0))
            attempts.append(len(results))
            raise workflow.DriverTimeoutError("second case never responds")

        with patch.object(workflow, "run_design_guidelines_review", run):
            with self.assertRaisesRegex(workflow.DriverTimeoutError, "second case never responds"):
                workflow.main()
        summary = self.read(fixture, "results.json")
        self.assertEqual(attempts, [1, 1, 1])
        self.assertEqual([row["consecutiveTimeouts"] for row in summary["driverRecoveries"]], [1, 2, 3])
        self.assertEqual(summary["results"], [])
        self.assertEqual(summary["status"], "failed_or_blocked")
        self.assertTrue(self.read(fixture, "cleanup.json")["sessionClosed"])

    def test_partial_checkpoint_cannot_retry_an_assertion(self):
        fixture = self.fixture(authorized=True)
        calls = []

        def run(session):
            workflow.CASE_RESULTS.setdefault("design-guidelines", []).append(case_result("design-guidelines", 0))
            calls.append(True)
            raise AssertionError("next case has a real defect")

        with patch.object(workflow, "run_design_guidelines_review", run):
            with self.assertRaisesRegex(AssertionError, "real defect"):
                workflow.main()
        self.assertEqual(len(calls), 1)
        self.assertEqual(self.read(fixture, "results.json")["driverRecoveries"], [])
        self.assertEqual(self.read(fixture, "results.json")["results"], [])

    def test_new_main_clears_checkpoints_and_ignores_old_json(self):
        fixture = self.fixture()
        observed = []

        def run(session):
            observed.append(dict(workflow.CASE_RESULTS))
            return [case_result("design-guidelines", index) for index in range(12)]

        with patch.object(workflow, "run_design_guidelines_review", run):
            workflow.CASE_RESULTS["design-guidelines"] = [case_result("design-guidelines", 0)]
            (fixture["output"] / "results.json").write_text(json.dumps({"status": "passed", "results": ["old-run"]}))
            workflow.main()
            workflow.CASE_RESULTS["design-guidelines"] = [case_result("design-guidelines", 0)]
            workflow.main()
        self.assertEqual(observed, [{}, {}])
        self.assertEqual(len(self.read(fixture, "results.json")["results"]), 78)

    def test_invalid_checkpoint_order_or_duplicates_fail_without_retry(self):
        for rows in ([0, 0], [1], [0, 2]):
            with self.subTest(rows=rows):
                fixture = self.fixture(authorized=True)

                def run(session):
                    results = workflow.CASE_RESULTS.setdefault("design-guidelines", [])
                    results.extend(case_result("design-guidelines", index) for index in rows)
                    raise workflow.DriverTimeoutError("timeout after malformed checkpoint")

                with patch.object(workflow, "run_design_guidelines_review", run):
                    with self.assertRaisesRegex(AssertionError, "Invalid completed case order"):
                        workflow.main()
                self.assertEqual(self.read(fixture, "results.json")["driverRecoveries"], [])

    def test_final_checkpoint_keys_are_validated_even_when_the_count_matches(self):
        fixture = self.fixture(authorized=True)
        rows = [case_result("design-guidelines", index) for index in range(12)]
        rows[-1] = rows[0]
        with patch.object(workflow, "run_design_guidelines_review", return_value=rows) as review:
            with self.assertRaisesRegex(AssertionError, "Invalid completed case order"):
                workflow.main()
        review.assert_called_once()
        self.assertEqual(self.read(fixture, "results.json")["results"], [])
        self.assertEqual(self.read(fixture, "results.json")["driverRecoveries"], [])

    def test_actual_case_loops_skip_only_exact_completed_keys_without_browser_calls(self):
        fixture = self.fixture()
        for stage, review in REAL_CHECKPOINT_REVIEWS.items():
            with self.subTest(stage=stage):
                rows = [case_result(stage, index) for index in range(workflow.EXPECTED_STAGE_CASES[stage])]
                if stage == "design-guidelines":
                    for row in rows:
                        row["outputKeyboardFocus"] = {"appearanceChecked": True}
                workflow.CASE_RESULTS.clear()
                workflow.CASE_RESULTS[stage] = rows
                session = Mock()
                self.assertIs(review(session), rows)
                self.assertEqual(session.mock_calls, [])
                workflow.CASE_RESULTS[stage] = rows[:1]
                self.assertTrue(workflow._case_completed(stage, rows[0]))
                self.assertFalse(workflow._case_completed(stage, rows[1]))

    def test_owned_driver_exit_reports_return_code_without_http(self):
        driver = FakeDriver(1234)
        driver.returncode = 7
        with patch.object(workflow.Session, "request", create=True) as request:
            with self.assertRaisesRegex(RuntimeError, "owned Safari driver exited with return code 7"):
                workflow._wait_driver(driver)
        request.assert_not_called()

    def test_assertions_are_never_retried(self):
        fixture = self.fixture(authorized=True, effects={"design-guidelines": [AssertionError("real defect")]})
        with self.assertRaisesRegex(AssertionError, "real defect"):
            workflow.main()
        summary = self.read(fixture, "results.json")
        self.assertEqual(summary["status"], "failed_or_blocked")
        self.assertEqual(fixture["calls"]["design-guidelines"], 1)
        self.assertEqual(summary["driverRecoveries"], [])
        self.assertEqual(fixture["restart"].call_count, 1)
        self.assertTrue(self.read(fixture, "cleanup.json")["sessionClosed"])

    def test_finally_timeout_cannot_mask_or_retry_an_assertion(self):
        original = AssertionError("original graph assertion failed")
        try:
            try:
                raise original
            finally:
                raise workflow.DriverTimeoutError("style cleanup timed out")
        except workflow.DriverTimeoutError as error:
            masked = error
        fixture = self.fixture(authorized=True, effects={"design-guidelines": [masked]})
        with self.assertRaises(AssertionError) as raised:
            workflow.main()
        self.assertIs(raised.exception, original)
        self.assertEqual(fixture["calls"]["design-guidelines"], 1)
        self.assertEqual(len(fixture["drivers"]), 1)
        self.assertEqual(fixture["restart"].call_count, 2)
        summary = self.read(fixture, "results.json")
        self.assertEqual(summary["status"], "failed_or_blocked")
        self.assertEqual(summary["error"], str(original))
        self.assertEqual(summary["driverRecoveries"], [])
        self.assertEqual(summary["currentStage"]["cleanupTransportError"], "style cleanup timed out")
        self.assertEqual(self.read(fixture, "cleanup.json")["method"], "authorized-browser-restart")

    def test_substantive_explicit_cause_is_preserved_without_retry(self):
        original = ValueError("invalid exported model")
        masked = workflow.DriverTimeoutError("cleanup timeout")
        masked.__cause__ = original
        fixture = self.fixture(authorized=True, effects={"design-guidelines": [masked]})
        with self.assertRaises(ValueError) as raised:
            workflow.main()
        self.assertIs(raised.exception, original)
        self.assertEqual(fixture["calls"]["design-guidelines"], 1)
        self.assertEqual(self.read(fixture, "results.json")["error"], str(original))
        self.assertEqual(self.read(fixture, "results.json")["driverRecoveries"], [])

    def test_transport_only_cause_chain_remains_retryable(self):
        timeout = workflow.DriverTimeoutError("transport timeout")
        timeout.__cause__ = socket.timeout("socket timed out")
        fixture = self.fixture(authorized=True, effects={"design-guidelines": [timeout]})
        workflow.main()
        self.assertEqual(fixture["calls"]["design-guidelines"], 2)
        self.assertEqual(self.read(fixture, "results.json")["status"], "passed")

    def test_exception_chain_cycles_are_safe_and_assertions_take_priority(self):
        assertion = AssertionError("original assertion")
        substantive = ValueError("secondary error")
        timeout = workflow.DriverTimeoutError("cleanup timeout")
        timeout.__context__ = substantive
        timeout.__cause__ = socket.timeout("socket timeout")
        substantive.__cause__ = assertion
        assertion.__context__ = timeout
        self.assertIs(workflow._substantive_exception(timeout), assertion)

    def test_wrong_counts_fail_without_retry(self):
        fixture = self.fixture(authorized=True, effects={"design-guidelines": [11]})
        with self.assertRaisesRegex(AssertionError, "Incomplete cases"):
            workflow.main()
        summary = self.read(fixture, "results.json")
        self.assertEqual(summary["status"], "failed_or_blocked")
        self.assertEqual(summary["results"], [])
        self.assertEqual(fixture["calls"]["design-guidelines"], 1)
        self.assertEqual(fixture["restart"].call_count, 1)

    def test_timeout_without_authorization_never_restarts_safari(self):
        fixture = self.fixture(effects={"design-guidelines": [workflow.DriverTimeoutError("timeout")]})
        with self.assertRaises(workflow.DriverTimeoutError):
            workflow.main()
        fixture["restart"].assert_not_called()
        self.assertEqual(len(fixture["drivers"]), 1)
        self.assertEqual(fixture["sessions"][0].closes, 0)
        cleanup = self.read(fixture, "cleanup.json")
        self.assertFalse(cleanup["sessionClosed"])
        self.assertTrue(cleanup["driverStopped"])
        self.assertEqual(self.read(fixture, "results.json")["status"], "failed_or_blocked")

    def test_timeout_attempts_are_bounded_and_failed_stage_stays_failed(self):
        fixture = self.fixture(authorized=True, effects={"design-guidelines": [
            workflow.DriverTimeoutError("timeout") for _ in range(3)
        ]})
        with self.assertRaises(workflow.DriverTimeoutError):
            workflow.main()
        summary = self.read(fixture, "results.json")
        cleanup = self.read(fixture, "cleanup.json")
        self.assertEqual(fixture["calls"]["design-guidelines"], 3)
        self.assertEqual(len(fixture["drivers"]), 3)
        self.assertEqual(fixture["restart"].call_count, 4)
        self.assertEqual(summary["status"], "failed_or_blocked")
        self.assertEqual(summary["results"], [])
        self.assertEqual(cleanup["method"], "authorized-browser-restart")
        self.assertTrue(cleanup["sessionClosed"] and cleanup["driverStopped"])

    def test_authorized_close_failure_uses_verified_browser_restart(self):
        fixture = self.fixture(authorized=True, close_error=workflow.DriverTimeoutError("delete timeout"))
        workflow.main()
        summary = self.read(fixture, "results.json")
        cleanup = self.read(fixture, "cleanup.json")
        self.assertEqual(summary["status"], "passed")
        self.assertEqual(cleanup["method"], "authorized-browser-restart")
        self.assertEqual(cleanup["webdriverCloseError"], "delete timeout")
        self.assertEqual(fixture["restart"].call_count, 2)
        self.assertTrue(cleanup["sessionClosed"] and cleanup["driverStopped"])

    def test_unauthorized_close_failure_does_not_claim_success(self):
        fixture = self.fixture(close_error=workflow.DriverTimeoutError("delete timeout"))
        with self.assertRaises(workflow.DriverTimeoutError):
            workflow.main()
        self.assertEqual(self.read(fixture, "results.json")["status"], "failed_or_blocked")
        self.assertTrue(self.read(fixture, "cleanup.json")["driverStopped"])
        fixture["restart"].assert_not_called()

    def test_changed_sources_fail_without_retry(self):
        fixture = self.fixture(authorized=True, fingerprint_change=True)
        with self.assertRaisesRegex(AssertionError, "sources or built preview changed"):
            workflow.main()
        self.assertEqual(fixture["calls"]["design-guidelines"], 1)
        self.assertEqual(self.read(fixture, "results.json")["status"], "failed_or_blocked")
        self.assertEqual(fixture["restart"].call_count, 1)

    def test_driver_start_failure_is_safe_with_no_session(self):
        fixture = self.fixture(start_error=OSError("driver unavailable"))
        with self.assertRaisesRegex(OSError, "driver unavailable"):
            workflow.main()
        cleanup = self.read(fixture, "cleanup.json")
        self.assertFalse(cleanup["sessionCreated"])
        self.assertTrue(cleanup["driverStopped"])
        self.assertEqual(self.read(fixture, "results.json")["status"], "failed_or_blocked")

    def test_only_owned_driver_can_be_force_killed(self):
        fixture = self.fixture(force_kill=True)
        workflow.main()
        self.assertEqual(fixture["drivers"][0].signals, ["terminate", "kill"])
        self.assertTrue(self.read(fixture, "cleanup.json")["driverStop"]["killed"])
        fixture["restart"].assert_not_called()

    def test_utilities_preserve_their_existing_modes(self):
        for argument, utility in (("--self-loops", "run_self_loop_review"),
                                  ("--text-weights", "run_text_weight_review")):
            with self.subTest(argument=argument):
                fixture = self.fixture(arguments=[argument])
                workflow.main()
                fixture["utilities"][utility].assert_called_once()
                fixture["restart"].assert_not_called()
                self.assertFalse((fixture["output"] / "results.json").exists())
                self.assertTrue(self.read(fixture, "cleanup.json")["sessionClosed"])

    def test_promo_preserves_its_existing_mode_without_native_recovery(self):
        fixture = self.fixture(promo=True)
        workflow.main()
        fixture["utilities"]["run_promo_recording"].assert_called_once()
        fixture["restart"].assert_not_called()
        self.assertFalse((fixture["output"] / "results.json").exists())
        self.assertFalse((fixture["output"] / "promo-request.json").exists())

    def test_native_gate_cannot_be_combined_with_promo(self):
        fixture = self.fixture(authorized=True, promo=True)
        with self.assertRaisesRegex(AssertionError, "restricted to the full"):
            workflow.main()
        self.assertEqual(fixture["drivers"], [])
        fixture["restart"].assert_not_called()

    def test_old_native_gate_payload_is_rejected(self):
        fixture = self.fixture(authorized=True)
        (fixture["output"] / "native-activation-request.json").write_text(json.dumps({
            "action": "activate-safari-for-78-case-review",
        }))
        with self.assertRaisesRegex(AssertionError, "Only fixed Safari recovery"):
            workflow.main()
        self.assertEqual(fixture["drivers"], [])
        fixture["restart"].assert_not_called()

    def test_authorized_activation_precedes_window_restore(self):
        for authorized in (False, True):
            with self.subTest(authorized=authorized):
                session = REAL_SESSION.__new__(REAL_SESSION)
                session.pointer_buttons = set()
                events = []

                def command(method, path, data=None):
                    events.append((method, path))
                    return "owned-window" if path == "/window" else {"x": 0, "y": 0, "width": 600, "height": 1000}

                session.command = command
                session.window_state = lambda: {"focused": True, "visibility": "visible"}
                with patch.object(workflow, "NATIVE_ACTIVATION_AUTHORIZED", authorized), patch.object(
                    workflow.subprocess, "run", side_effect=lambda args, **kwargs: events.append(tuple(args)),
                ) as run:
                    session.focus_window()
                    if authorized:
                        self.assertEqual(events[0], ("/usr/bin/open", "-a", "Safari"))
                        run.assert_called_once()
                    else:
                        self.assertEqual(events[0], ("GET", "/window"))
                        run.assert_not_called()

    def test_element_lookup_preserves_webdriver_reference_without_async_find(self):
        session = REAL_SESSION.__new__(REAL_SESSION)
        session.wait = Mock(return_value={workflow.ELEMENT: "owned-element"})
        session.command = Mock()
        self.assertEqual(session.element('[data-editor-panel="png"] input'), "owned-element")
        session.wait.assert_called_once()
        self.assertIn("document.querySelector", session.wait.call_args.args[0])
        session.command.assert_not_called()

    def pointer_session(self):
        session = REAL_SESSION.__new__(REAL_SESSION)
        session.id = "owned-pointer-session"
        session.transport_error = None
        session.pointer_buttons = set()
        session.window_state = Mock(return_value={"focused": False, "visibility": "hidden"})
        session.focus_window = Mock()
        session.request = Mock(side_effect=lambda method, path, data=None:
                               workflow.ORIGIN + "/" if method == "GET" and path.endswith("/url") else None)
        return session

    def pointer_action(self, session, kind, *, source="mouse", button=0):
        return session.command("POST", "/actions", {"actions": [{
            "type": "pointer", "id": source, "parameters": {"pointerType": "mouse"},
            "actions": [{"type": kind, "button": button}],
        }]})

    def test_new_session_starts_without_held_pointer_buttons(self):
        with patch.object(REAL_SESSION, "request", return_value={
            "sessionId": "owned-new-session", "capabilities": {"browserName": "safari"},
        }):
            session = REAL_SESSION()
        self.assertEqual(session.pointer_buttons, set())

    def test_held_pointer_continuations_do_not_restore_focus_until_release(self):
        session = self.pointer_session()
        self.pointer_action(session, "pointerDown")
        self.assertEqual(session.pointer_buttons, {("mouse", 0)})
        session.focus_window.assert_called_once()
        session.window_state.reset_mock()
        session.focus_window.reset_mock()
        self.pointer_action(session, "pointerMove")
        session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": []}]})
        self.assertEqual(session.pointer_buttons, {("mouse", 0)})
        self.pointer_action(session, "pointerUp")
        self.assertEqual(session.pointer_buttons, set())
        session.window_state.assert_not_called()
        session.focus_window.assert_not_called()
        session.command("POST", "/element/node/click", {})
        session.window_state.assert_called_once()
        session.focus_window.assert_called_once()

    def test_release_actions_clears_all_sources_and_resumes_focus_guard(self):
        session = self.pointer_session()
        self.pointer_action(session, "pointerDown", source="first", button=0)
        self.pointer_action(session, "pointerDown", source="second", button=2)
        self.assertEqual(session.pointer_buttons, {("first", 0), ("second", 2)})
        self.pointer_action(session, "pointerUp", source="first", button=0)
        self.assertEqual(session.pointer_buttons, {("second", 2)})
        session.focus_window.reset_mock()
        session.command("DELETE", "/actions")
        self.assertEqual(session.pointer_buttons, set())
        session.focus_window.assert_not_called()
        session.command("POST", "/element/node/click", {})
        session.focus_window.assert_called_once()

    def test_wait_preserves_a_held_drag_without_restore_or_minimize(self):
        session = self.pointer_session()
        session.pointer_buttons = {("mouse", 0)}
        session.js = Mock(side_effect=[False, False, True])
        with patch.object(workflow.time, "monotonic", side_effect=[0, 0, 0.1, 0.2]), patch.object(workflow.time, "sleep"):
            self.assertTrue(session.wait("return dragPreviewMatches"))
        self.assertEqual(session.js.call_count, 3)
        self.assertEqual(session.pointer_buttons, {("mouse", 0)})
        session.window_state.assert_not_called()
        session.focus_window.assert_not_called()
        session.request.assert_not_called()

    def test_explicit_focus_restore_does_nothing_during_a_held_drag(self):
        session = REAL_SESSION.__new__(REAL_SESSION)
        session.pointer_buttons = {("mouse", 0)}
        session.command = Mock()
        session.window_state = Mock()
        with patch.object(workflow, "NATIVE_ACTIVATION_AUTHORIZED", True), patch.object(workflow.subprocess, "run") as run:
            session.focus_window()
        run.assert_not_called()
        session.command.assert_not_called()
        session.window_state.assert_not_called()

    def test_failed_pointer_release_or_delete_does_not_clear_held_state(self):
        for method, path, data in (
            ("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "actions": [{"type": "pointerUp", "button": 0}]}]}),
            ("DELETE", "/actions", None),
        ):
            with self.subTest(method=method):
                session = self.pointer_session()
                session.pointer_buttons = {("mouse", 0)}
                error = workflow.DriverTimeoutError("release timed out")

                def request(request_method, request_path, request_data=None):
                    if request_method == "GET" and request_path.endswith("/url"):
                        return workflow.ORIGIN + "/"
                    raise error

                session.request.side_effect = request
                with self.assertRaises(workflow.DriverTimeoutError):
                    session.command(method, path, data)
                self.assertEqual(session.pointer_buttons, {("mouse", 0)})
                self.assertIs(session.transport_error, error)
                calls = session.request.call_count
                with self.assertRaises(workflow.DriverTimeoutError):
                    session.command("DELETE", "/actions")
                self.assertEqual(session.request.call_count, calls)
                self.assertEqual(session.pointer_buttons, {("mouse", 0)})
                session.focus_window.assert_not_called()

    def test_transport_timeout_never_replays_get_or_post(self):
        for method in ("GET", "POST"):
            with self.subTest(method=method), patch.object(
                workflow.urllib.request, "urlopen", side_effect=socket.timeout("blocked"),
            ) as urlopen:
                with self.assertRaises(workflow.DriverTimeoutError):
                    REAL_SESSION.request(method, "/session/mock/url", {} if method == "POST" else None)
                self.assertEqual(urlopen.call_count, 1)

    def test_failed_session_latches_timeout_without_further_http(self):
        session = REAL_SESSION.__new__(REAL_SESSION)
        session.id = "owned-mock-session"
        session.transport_error = None
        error = workflow.DriverTimeoutError("first HTTP timeout")
        with patch.object(REAL_SESSION, "request", side_effect=error) as request:
            with self.assertRaises(workflow.DriverTimeoutError) as first:
                session.command("GET", "/url")
            with self.assertRaises(workflow.DriverTimeoutError) as second:
                session.command("POST", "/actions", {"actions": []})
            with self.assertRaises(workflow.DriverTimeoutError) as third:
                session.close()
            self.assertIs(first.exception, error)
            self.assertIs(second.exception, error)
            self.assertIs(third.exception, error)
            self.assertIs(session.transport_error, error)
            request.assert_called_once_with("GET", "/session/owned-mock-session/url")


if __name__ == "__main__":
    unittest.main()
