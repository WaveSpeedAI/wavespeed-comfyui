"""Channel-attribution client info shared by all WaveSpeed API requests."""
import os
import platform
import re
from pathlib import Path

DEFAULT_CLIENT_NAME = "wavespeed-comfyui"


def _read_version():
    """Read the node pack version from pyproject.toml."""
    try:
        pyproject = Path(__file__).resolve().parents[1] / "pyproject.toml"
        match = re.search(r'^version\s*=\s*"([^"]+)"', pyproject.read_text(encoding="utf-8"), re.MULTILINE)
        if match:
            return match.group(1)
    except OSError:
        pass
    return "unknown"


CLIENT_VERSION = _read_version()


def get_client_os():
    """Get the client OS name using the desktop client's vocabulary."""
    system = platform.system().lower()
    if system == "windows":
        return "win32"
    return system or "unknown"


def get_client_headers():
    """Build the channel-attribution headers sent with every API request.

    The WAVESPEED_CLIENT_NAME environment variable overrides the default
    client name so wrapper channels can brand themselves without code changes.
    """
    return {
        "X-Client-Name": os.environ.get("WAVESPEED_CLIENT_NAME") or DEFAULT_CLIENT_NAME,
        "X-Client-Version": CLIENT_VERSION,
        "X-Client-OS": get_client_os(),
    }
