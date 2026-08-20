"""Provider-agnostic direct uploads for WaveSpeed media."""

import requests

try:
    from .wavespeed_client_info import get_client_headers
except ImportError:
    from wavespeed_client_info import get_client_headers


def _ticket_payload(file_bytes, filename, content_type=None):
    payload = {"filename": filename, "size": len(file_bytes)}
    if content_type:
        payload["content_type"] = content_type
    return payload


def _parse_ticket(result):
    if not isinstance(result, dict) or result.get("code") != 200:
        message = result.get("message", "Unknown error") if isinstance(result, dict) else "Invalid response"
        raise ValueError(f"Upload ticket failed: {message}")
    data = result.get("data") or {}
    upload = data.get("upload") or {}
    if not data.get("download_url") or not upload.get("url"):
        raise ValueError("Upload ticket returned no upload or download URL")
    return data, upload


def upload_bytes(file_bytes, filename, content_type, api_key, base_url="https://api.wavespeed.ai", session=None):
    """Create an upload ticket, upload bytes directly, and return the stable media URL."""
    http = session or requests
    ticket = http.post(
        f"{base_url.rstrip('/')}/api/v3/media/uploads",
        json=_ticket_payload(file_bytes, filename, content_type),
        headers={"Authorization": f"Bearer {api_key}", **get_client_headers()},
        timeout=(15, 180),
    )
    if ticket.status_code != 200:
        raise ValueError(f"Upload ticket failed with status {ticket.status_code}: {ticket.text}")
    data, upload = _parse_ticket(ticket.json())

    response = http.request(
        upload.get("method") or "PUT",
        upload["url"],
        data=file_bytes,
        headers=upload.get("headers") or {},
        timeout=(15, 180),
    )
    if not 200 <= response.status_code < 300:
        raise ValueError(f"Upload failed with status {response.status_code}: {response.text}")
    return data["download_url"]


async def upload_bytes_async(session, file_bytes, filename, content_type, api_key, base_url="https://api.wavespeed.ai"):
    """Async variant used by the ComfyUI HTTP endpoint."""
    headers = {"Authorization": f"Bearer {api_key}", **get_client_headers()}
    async with session.post(
        f"{base_url.rstrip('/')}/api/v3/media/uploads",
        json=_ticket_payload(file_bytes, filename, content_type),
        headers=headers,
    ) as response:
        if response.status != 200:
            raise ValueError(f"Upload ticket failed with status {response.status}: {await response.text()}")
        data, upload = _parse_ticket(await response.json())

    async with session.request(
        upload.get("method") or "PUT",
        upload["url"],
        data=file_bytes,
        headers=upload.get("headers") or {},
    ) as response:
        if not 200 <= response.status < 300:
            raise ValueError(f"Upload failed with status {response.status}: {await response.text()}")
    return data["download_url"]
