import unittest
from unittest.mock import Mock
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "py"))
from wavespeed_client_info import CLIENT_VERSION
from wavespeed_upload import upload_bytes


class UploadTest(unittest.TestCase):
    def test_direct_upload_does_not_forward_credentials(self):
        ticket = Mock(status_code=200)
        ticket.json.return_value = {
            "code": 200,
            "data": {
                "download_url": "https://example.com/file.png",
                "upload": {
                    "method": "PUT",
                    "url": "https://storage.example/upload",
                    "headers": {"Content-Type": "image/png"},
                },
            },
        }
        uploaded = Mock(status_code=200)
        session = Mock()
        session.post.return_value = ticket
        session.request.return_value = uploaded

        result = upload_bytes(b"image", "file.png", "image/png", "secret", session=session)

        self.assertEqual("https://example.com/file.png", result)
        self.assertEqual(5, session.post.call_args.kwargs["json"]["size"])
        self.assertEqual({"Content-Type": "image/png"}, session.request.call_args.kwargs["headers"])
        self.assertNotIn("Authorization", session.request.call_args.kwargs["headers"])

    def test_ticket_request_sends_attribution_headers(self):
        ticket = Mock(status_code=200)
        ticket.json.return_value = {
            "code": 200,
            "data": {
                "download_url": "https://example.com/file.png",
                "upload": {
                    "method": "PUT",
                    "url": "https://storage.example/upload",
                    "headers": {"Content-Type": "image/png"},
                },
            },
        }
        session = Mock()
        session.post.return_value = ticket
        session.request.return_value = Mock(status_code=200)

        upload_bytes(b"image", "file.png", "image/png", "secret", session=session)

        headers = session.post.call_args.kwargs["headers"]
        self.assertEqual("wavespeed-comfyui", headers["X-Client-Name"])
        self.assertEqual(CLIENT_VERSION, headers["X-Client-Version"])
        self.assertIn(headers["X-Client-OS"], {"linux", "darwin", "win32"})


if __name__ == "__main__":
    unittest.main()
