import os
import re
import signal
import subprocess
import sys
import time


def _safari_pid():
    result = subprocess.run(
        ["/usr/bin/pgrep", "-x", "Safari"],
        capture_output=True, text=True, timeout=3, check=False,
    )
    if result.returncode == 1 and not result.stdout.strip():
        return None
    if result.returncode != 0:
        raise RuntimeError("Could not identify the Safari process")
    pids = result.stdout.split()
    if len(pids) != 1 or not re.fullmatch(r"[1-9][0-9]*", pids[0]):
        raise RuntimeError("Safari restart requires exactly one valid process ID")
    pid = int(pids[0])
    identity = subprocess.run(
        ["/bin/ps", "-p", str(pid), "-o", "uid=,comm="],
        capture_output=True, text=True, timeout=3, check=False,
    )
    if identity.returncode == 1 and not identity.stdout.strip():
        return None
    lines = identity.stdout.strip().splitlines()
    if identity.returncode != 0 or len(lines) != 1:
        raise RuntimeError("Could not verify the Safari process identity")
    fields = lines[0].split(None, 1)
    if (len(fields) != 2 or not fields[0].isascii()
            or not fields[0].isdecimal() or int(fields[0]) != os.getuid()
            or not fields[1].endswith("/Safari.app/Contents/MacOS/Safari")
            or not fields[1].startswith("/")):
        raise RuntimeError("Safari process owner or executable did not match")
    return pid


def restart_safari(authorized: bool):
    if authorized is not True:
        raise PermissionError("Safari restart requires explicit user authorization")
    report = {"status": "running", "quitReturnCode": None,
              "quitTimedOut": False, "terminatedPid": None,
              "exitConfirmed": False, "opened": False, "openAttempts": []}
    try:
        result = subprocess.run(
            ["/usr/bin/osascript", "-e", 'tell application "Safari" to quit'],
            capture_output=True, text=True, timeout=10, check=False,
        )
        report["quitReturnCode"] = result.returncode
    except subprocess.TimeoutExpired:
        report["quitTimedOut"] = True

    if report["quitReturnCode"] == 0:
        time.sleep(0.2)
    pid = _safari_pid()
    if pid is not None and report["quitReturnCode"] == 0:
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline:
            time.sleep(0.1)
            current = _safari_pid()
            if current is None:
                pid = None
                break
            if current != pid:
                raise RuntimeError("Safari process changed before termination")
    if pid is not None:
        current = _safari_pid()
        if current is not None:
            if current != pid:
                raise RuntimeError("Safari process changed before termination")
            try:
                os.kill(pid, signal.SIGTERM)
                report["terminatedPid"] = pid
            except ProcessLookupError:
                pass

    deadline = time.monotonic() + 10
    while True:
        current = _safari_pid()
        if current is None:
            report["exitConfirmed"] = True
            break
        if current != pid:
            raise RuntimeError("Safari process changed while waiting for exit")
        if time.monotonic() >= deadline:
            raise RuntimeError("Safari did not exit; refusing to reopen it")
        time.sleep(0.1)

    time.sleep(1)
    for attempt in (1, 2):
        entry = {"attempt": attempt, "returnCode": None, "timedOut": False, "stderr": ""}
        report["openAttempts"].append(entry)
        try:
            opened = subprocess.run(["/usr/bin/open", "-a", "Safari"],
                                    capture_output=True, text=True, timeout=10, check=True)
            entry.update({"returnCode": opened.returncode, "stderr": opened.stderr or ""})
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            stderr = error.stderr or ""
            entry["stderr"] = stderr.decode("utf-8", errors="replace") if isinstance(stderr, bytes) else stderr
            entry["timedOut"] = isinstance(error, subprocess.TimeoutExpired)
            if isinstance(error, subprocess.CalledProcessError):
                entry["returnCode"] = error.returncode
            if attempt == 2:
                report["status"] = "failed"
                details = "; ".join(f"attempt {item['attempt']}: "
                                    f"{'timed out' if item['timedOut'] else 'exit ' + str(item['returnCode'])}; "
                                    f"stderr={item['stderr']!r}" for item in report["openAttempts"])
                failure = RuntimeError("Safari startup failed after two attempts: " + details)
                failure.report = report
                raise failure from error
            time.sleep(1)
            continue
        time.sleep(1)
        report["opened"] = True
        report["status"] = "restarted"
        return report


def self_test():
    import unittest
    from unittest.mock import patch

    module = sys.modules[__name__]

    class RuntimeTests(unittest.TestCase):
        def fixture(self, *, quit_code=0, quit_timeout=False, processes=None,
                    owner=501, executable="/Applications/Safari.app/Contents/MacOS/Safari",
                    persistent=False, kill_missing=False, open_error=False,
                    open_failures=0, open_timeout=False,
                    pgrep_code=None, ps_output=None):
            clock = [0.0]
            sequence = iter(processes if processes is not None else [None])
            current = [None]
            commands = []
            open_count = [0]

            def run(args, **kwargs):
                commands.append((args, kwargs))
                if args == ["/usr/bin/osascript", "-e", 'tell application "Safari" to quit']:
                    if quit_timeout:
                        raise subprocess.TimeoutExpired(args, 10)
                    return subprocess.CompletedProcess(args, quit_code, "", "-128" if quit_code else "")
                if args == ["/usr/bin/pgrep", "-x", "Safari"]:
                    try:
                        current[0] = next(sequence)
                    except StopIteration:
                        if not persistent:
                            current[0] = None
                    value = current[0]
                    text = "" if value is None else str(value) + "\n"
                    return subprocess.CompletedProcess(args, pgrep_code if pgrep_code is not None else (1 if value is None else 0), text, "")
                if args[:2] == ["/bin/ps", "-p"]:
                    self.assertEqual(args, ["/bin/ps", "-p", str(current[0]), "-o", "uid=,comm="])
                    output = ps_output if ps_output is not None else f"{owner} {executable}\n"
                    return subprocess.CompletedProcess(args, 0, output, "")
                if args == ["/usr/bin/open", "-a", "Safari"]:
                    self.assertTrue(kwargs["check"])
                    open_count[0] += 1
                    if open_timeout:
                        raise subprocess.TimeoutExpired(args, 10, stderr=b"LaunchServices startup timed out")
                    if open_error or open_count[0] <= open_failures:
                        raise subprocess.CalledProcessError(1, args, stderr=f"LaunchServices startup failure {open_count[0]}")
                    return subprocess.CompletedProcess(args, 0, "", "")
                self.fail(f"Unexpected subprocess command: {args}")

            def sleep(seconds):
                self.assertGreaterEqual(seconds, 0)
                clock[0] += seconds

            patches = [patch.object(module.subprocess, "run", side_effect=run),
                       patch.object(module.os, "getuid", return_value=501),
                       patch.object(module.os, "kill", side_effect=ProcessLookupError if kill_missing else None),
                       patch.object(module.time, "monotonic", side_effect=lambda: clock[0]),
                       patch.object(module.time, "sleep", side_effect=sleep)]
            mocks = [entry.start() for entry in patches]
            for entry in patches:
                self.addCleanup(entry.stop)
            return commands, mocks[2]

        def assert_no_open(self, commands):
            self.assertFalse(any(args[0] == "/usr/bin/open" for args, _ in commands))

        def test_authorization_precedes_every_operation(self):
            with patch.object(module.subprocess, "run") as run, patch.object(module.os, "kill") as kill:
                for value in (False, None, 0, 1, "true", object()):
                    with self.subTest(value=value), self.assertRaises(PermissionError):
                        restart_safari(value)
                run.assert_not_called()
                kill.assert_not_called()

        def test_normal_quit_needs_no_signal(self):
            commands, kill = self.fixture()
            report = restart_safari(True)
            self.assertEqual(report, {"status": "restarted", "quitReturnCode": 0,
                                      "quitTimedOut": False, "terminatedPid": None,
                                      "exitConfirmed": True, "opened": True,
                                      "openAttempts": [{"attempt": 1, "returnCode": 0,
                                                        "timedOut": False, "stderr": ""}]})
            kill.assert_not_called()
            self.assertEqual(commands[0][1]["timeout"], 10)
            self.assertEqual(commands[-1][0], ["/usr/bin/open", "-a", "Safari"])
            self.assertEqual([call.args[0] for call in module.time.sleep.call_args_list], [0.2, 1, 1])

        def test_delayed_normal_quit_needs_no_signal(self):
            _, kill = self.fixture(processes=[123, 123, None, None])
            report = restart_safari(True)
            kill.assert_not_called()
            self.assertIsNone(report["terminatedPid"])
            self.assertTrue(report["exitConfirmed"])
            self.assertTrue(report["opened"])

        def test_refused_quit_uses_only_verified_sigterm(self):
            commands, kill = self.fixture(quit_code=1, processes=[123, 123, None])
            report = restart_safari(True)
            kill.assert_called_once_with(123, signal.SIGTERM)
            self.assertEqual(report["terminatedPid"], 123)
            self.assertEqual(report["quitReturnCode"], 1)
            self.assertTrue(report["exitConfirmed"])
            self.assertTrue(report["opened"])
            self.assertEqual([args[0] for args, _ in commands[:5]],
                             ["/usr/bin/osascript", "/usr/bin/pgrep", "/bin/ps", "/usr/bin/pgrep", "/bin/ps"])

        def test_quit_timeout_can_use_verified_sigterm(self):
            _, kill = self.fixture(quit_timeout=True, processes=[123, 123, None])
            report = restart_safari(True)
            self.assertTrue(report["quitTimedOut"])
            kill.assert_called_once_with(123, signal.SIGTERM)

        def test_wrong_owner_is_rejected(self):
            commands, kill = self.fixture(processes=[123], owner=502)
            with self.assertRaisesRegex(RuntimeError, "owner or executable"):
                restart_safari(True)
            kill.assert_not_called()
            self.assert_no_open(commands)

        def test_wrong_executable_is_rejected(self):
            commands, kill = self.fixture(processes=[123], executable="/Applications/Other.app/Contents/MacOS/Safari")
            with self.assertRaisesRegex(RuntimeError, "owner or executable"):
                restart_safari(True)
            kill.assert_not_called()
            self.assert_no_open(commands)

        def test_multiple_or_invalid_pids_are_rejected(self):
            for value in ("123\n456", "0", "-123", "bad", "１２３"):
                with self.subTest(value=value):
                    commands, kill = self.fixture(processes=[value])
                    with self.assertRaisesRegex(RuntimeError, "exactly one valid"):
                        restart_safari(True)
                    kill.assert_not_called()
                    self.assert_no_open(commands)

        def test_identity_is_rechecked_before_sigterm(self):
            commands, kill = self.fixture(processes=[123, 456])
            with self.assertRaisesRegex(RuntimeError, "changed before"):
                restart_safari(True)
            kill.assert_not_called()
            self.assert_no_open(commands)

        def test_process_exiting_before_signal_needs_no_signal(self):
            _, kill = self.fixture(processes=[123, None, None])
            report = restart_safari(True)
            kill.assert_not_called()
            self.assertIsNone(report["terminatedPid"])
            self.assertTrue(report["opened"])

        def test_missing_process_at_signal_is_safe(self):
            _, kill = self.fixture(quit_code=1, processes=[123, 123, None], kill_missing=True)
            report = restart_safari(True)
            kill.assert_called_once_with(123, signal.SIGTERM)
            self.assertIsNone(report["terminatedPid"])
            self.assertTrue(report["exitConfirmed"])

        def test_exit_timeout_never_reopens_or_escalates_signal(self):
            commands, kill = self.fixture(processes=[123], persistent=True)
            with self.assertRaisesRegex(RuntimeError, "did not exit"):
                restart_safari(True)
            kill.assert_called_once_with(123, signal.SIGTERM)
            self.assert_no_open(commands)

        def test_replacement_process_during_exit_is_rejected(self):
            commands, kill = self.fixture(quit_code=1, processes=[123, 123, 456])
            with self.assertRaisesRegex(RuntimeError, "changed while"):
                restart_safari(True)
            kill.assert_called_once_with(123, signal.SIGTERM)
            self.assert_no_open(commands)

        def test_pgrep_error_never_signals_or_opens(self):
            commands, kill = self.fixture(processes=[None], pgrep_code=2)
            with self.assertRaisesRegex(RuntimeError, "identify"):
                restart_safari(True)
            kill.assert_not_called()
            self.assert_no_open(commands)

        def test_invalid_identity_never_signals_or_opens(self):
            commands, kill = self.fixture(processes=[123], ps_output="501 /Applications/Safari.app/Contents/MacOS/Safari\n501 other\n")
            with self.assertRaisesRegex(RuntimeError, "verify"):
                restart_safari(True)
            kill.assert_not_called()
            self.assert_no_open(commands)

        def test_open_failure_does_not_report_success(self):
            commands, kill = self.fixture(open_error=True)
            with self.assertRaisesRegex(RuntimeError, "LaunchServices startup failure 2") as raised:
                restart_safari(True)
            kill.assert_not_called()
            self.assertEqual(sum(args[0] == "/usr/bin/open" for args, _ in commands), 2)
            self.assertFalse(raised.exception.report["opened"])
            self.assertEqual(raised.exception.report["status"], "failed")
            self.assertEqual([item["stderr"] for item in raised.exception.report["openAttempts"]],
                             ["LaunchServices startup failure 1", "LaunchServices startup failure 2"])

        def test_first_open_failure_then_success_is_reported(self):
            commands, kill = self.fixture(open_failures=1)
            report = restart_safari(True)
            kill.assert_not_called()
            self.assertTrue(report["opened"])
            self.assertEqual(report["status"], "restarted")
            self.assertEqual([item["returnCode"] for item in report["openAttempts"]], [1, 0])
            self.assertEqual(report["openAttempts"][0]["stderr"], "LaunchServices startup failure 1")
            self.assertEqual(sum(args[0] == "/usr/bin/open" for args, _ in commands), 2)
            self.assertEqual(sum(args[0] == "/usr/bin/osascript" for args, _ in commands), 1)

        def test_open_timeouts_are_bounded_and_expose_stderr(self):
            commands, kill = self.fixture(open_timeout=True)
            with self.assertRaisesRegex(RuntimeError, "LaunchServices startup timed out") as raised:
                restart_safari(True)
            kill.assert_not_called()
            self.assertEqual(sum(args[0] == "/usr/bin/open" for args, _ in commands), 2)
            self.assertFalse(raised.exception.report["opened"])
            self.assertTrue(all(item["timedOut"] for item in raised.exception.report["openAttempts"]))

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(RuntimeTests)
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    if not result.wasSuccessful():
        raise AssertionError("Safari runtime self-tests failed")
    return {"status": "passed", "tests": result.testsRun, "realSafariOperations": 0}


if __name__ == "__main__":
    if sys.argv[1:] != ["--self-test"]:
        raise SystemExit("Only --self-test is accepted; application control is runner-only")
    import json
    print(json.dumps(self_test()))
