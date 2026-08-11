import unittest
from unittest.mock import Mock
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "py"))
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


if __name__ == "__main__":
    unittest.main()
