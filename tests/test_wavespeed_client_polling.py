import importlib
import sys
import threading
import types
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest.mock import patch

PY_DIR = Path(__file__).resolve().parents[1] / "py"


def load_client_module():
    """Load py/wavespeed_api/client.py as part of a synthetic package, stubbing
    wavespeed_api.utils (needs torch/ComfyUI) so no ComfyUI install is required."""
    root = types.ModuleType("wsfake")
    root.__path__ = [str(PY_DIR)]
    api = types.ModuleType("wsfake.wavespeed_api")
    api.__path__ = [str(PY_DIR / "wavespeed_api")]
    utils = types.ModuleType("wsfake.wavespeed_api.utils")
    utils.BaseRequest = object
    sys.modules.update({"wsfake": root, "wsfake.wavespeed_api": api, "wsfake.wavespeed_api.utils": utils})
    return importlib.import_module("wsfake.wavespeed_api.client")


client_mod = load_client_module()


class FakeServer:
    """Scripted server: each request pops the next status; records (method, path)."""

    def __init__(self, statuses):
        self.statuses = list(statuses)
        self.requests = []
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def _respond(self):
                outer.requests.append((self.command, self.path))
                status = outer.statuses.pop(0) if outer.statuses else 200
                body = b'{"code":200,"data":{"status":"completed","id":"t1"}}' if status == 200 else b'{"message":"bad"}'
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            do_GET = _respond

            def do_POST(self):
                self.rfile.read(int(self.headers.get("Content-Length", 0)))
                self._respond()

            def log_message(self, *args):
                pass

        self.httpd = HTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    @property
    def url(self):
        return f"http://127.0.0.1:{self.httpd.server_port}"

    def close(self):
        self.httpd.shutdown()
        self.httpd.server_close()


class PollingTest(unittest.TestCase):
    def make(self, statuses):
        server = FakeServer(statuses)
        self.addCleanup(server.close)
        client = client_mod.WaveSpeedClient("key")
        client.BASE_URL = server.url
        return client, server

    def test_poll_502_then_success(self):
        client, server = self.make([502, 503, 200])
        with patch.object(client_mod.time, "sleep") as sleep:
            result = client.check_task_status("t1")
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(server.requests), 3)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [1.0, 2.0])

    def test_persistent_poll_failure_names_task_id(self):
        client, server = self.make([502] * 20)
        with patch.object(client_mod.time, "sleep") as sleep:
            with self.assertRaises(Exception) as ctx:
                client.wait_for_task("task-abc", polling_interval=0)
        self.assertIn("task-abc", str(ctx.exception))
        self.assertNotIsInstance(ctx.exception, client_mod.requests.exceptions.RetryError)
        self.assertEqual(len(server.requests), client_mod.POLL_MAX_RETRIES + 1)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [1.0, 2.0, 3.0, 4.0, 5.0])

    def test_connection_error_names_task_id(self):
        client, _ = self.make([])
        client.BASE_URL = "http://127.0.0.1:1"  # nothing listening
        with patch.object(client_mod.time, "sleep"):
            with self.assertRaises(Exception) as ctx:
                client.check_task_status("task-conn")
        self.assertIn("task-conn", str(ctx.exception))

    def test_non_transient_poll_error_not_retried(self):
        client, server = self.make([404])
        with patch.object(client_mod.time, "sleep") as sleep:
            with self.assertRaises(Exception) as ctx:
                client.check_task_status("task-404")
        self.assertIn("task-404", str(ctx.exception))
        self.assertEqual(len(server.requests), 1)
        sleep.assert_not_called()

    def test_post_is_never_retried_on_status(self):
        for status in (502, 503, 504, 429, 500):
            client, server = self.make([status, 200])
            with self.assertRaises(Exception):
                client.post("/api/v3/some/model", {"prompt": "x"})
            self.assertEqual([m for m, _ in server.requests], ["POST"], f"status {status}")


if __name__ == "__main__":
    unittest.main()
