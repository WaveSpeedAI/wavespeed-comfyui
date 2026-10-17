import importlib
import re
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

PY_DIR = Path(__file__).resolve().parents[1] / "py"


def load_utils():
    """Load py/wavespeed_api/utils.py with ComfyUI-only modules stubbed."""
    for name in ("comfy_api", "comfy_api.input", "torchaudio", "av"):
        if name not in sys.modules:
            try:
                importlib.import_module(name)
            except Exception:
                sys.modules[name] = MagicMock()
    root = types.ModuleType("wsfake2")
    root.__path__ = [str(PY_DIR)]
    api = types.ModuleType("wsfake2.wavespeed_api")
    api.__path__ = [str(PY_DIR / "wavespeed_api")]
    sys.modules.update({"wsfake2": root, "wsfake2.wavespeed_api": api})
    return importlib.import_module("wsfake2.wavespeed_api.utils")


class RequestTimeoutTest(unittest.TestCase):
    def test_fetch_image_is_bounded(self):
        utils = load_utils()
        with patch.object(utils.requests, "get") as get:
            get.return_value.content = b"x"
            utils.fetch_image("https://cdn.example/a.png")
        self.assertEqual((10, 120), get.call_args.kwargs["timeout"])

    def test_predictor_makes_no_direct_http_calls(self):
        src = (PY_DIR / "wavespeed_predictor.py").read_text()
        # All WaveSpeed traffic must go through the client helpers (30/60/120 timeouts).
        self.assertIsNone(re.search(r"\b(requests|urllib|aiohttp|httpx)\.\w+\(|urlopen\(", src))

    def test_every_requests_call_in_py_has_timeout(self):
        offenders = []
        for path in PY_DIR.rglob("*.py"):
            text = path.read_text()
            for m in re.finditer(r"\brequests\.(get|post|put|head|request|delete)\(", text):
                call = text[m.start(): m.start() + 400].split("\n\n")[0]
                depth, end = 0, m.end() - 1
                for i, ch in enumerate(text[end:], end):
                    depth += ch == "("
                    depth -= ch == ")"
                    if depth == 0:
                        call = text[m.start(): i + 1]
                        break
                if "timeout" not in call:
                    offenders.append(f"{path.name}: {call[:60]}")
        self.assertEqual([], offenders)


if __name__ == "__main__":
    unittest.main()
