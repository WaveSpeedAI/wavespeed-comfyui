import unittest
from unittest.mock import patch

from test_wavespeed_client_polling import client_mod
from test_wavespeed_request_timeouts import load_utils


def addr(ip):
    return [(0, 0, 0, "", (ip, 443))]


class ApiUrlTest(unittest.TestCase):
    def setUp(self):
        self.client = client_mod.WaveSpeedClient("k")

    def test_normal_api_path(self):
        self.assertEqual("https://api.wavespeed.ai/api/v3/google/nano-banana/edit",
                         self.client._api_url("/api/v3/google/nano-banana/edit"))

    def test_paths_that_leave_the_api_host_are_refused(self):
        for bad in ["@evil.example/x", ".evil.example/x", ":8080/x", "\\\\@evil.example/x",
                    "api/v3/x", "", None]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                self.client._api_url(bad)

    def test_post_never_sends_key_to_other_host(self):
        with patch.object(self.client.session, "post") as post, self.assertRaises(ValueError):
            self.client.post("@evil.example/x", {})
        post.assert_not_called()


class MediaUrlTest(unittest.TestCase):
    utils = load_utils()

    def test_public_url_allowed(self):
        with patch.object(self.utils.socket, "getaddrinfo", return_value=addr("93.184.216.34")):
            self.utils._check_public_url("https://cdn.example/a.png")

    def test_private_and_non_http_refused(self):
        for url, ip in [("http://127.0.0.1:8188/x", "127.0.0.1"), ("http://10.0.0.5/x", "10.0.0.5"),
                        ("http://169.254.169.254/latest/meta-data", "169.254.169.254"),
                        ("http://[::1]/x", "::1"), ("file:///etc/passwd", "93.184.216.34")]:
            with self.subTest(url=url), patch.object(self.utils.socket, "getaddrinfo", return_value=addr(ip)), \
                    self.assertRaises(ValueError):
                self.utils._check_public_url(url)

    def test_redirect_to_private_address_refused(self):
        ips = {"cdn.example": "93.184.216.34", "internal.example": "192.168.1.2"}
        with patch.object(self.utils.socket, "getaddrinfo", side_effect=lambda h, *a, **k: addr(ips[h])), \
                patch.object(self.utils.requests, "request") as request, self.assertRaises(ValueError):
            request.return_value.is_redirect = True
            request.return_value.headers = {"Location": "http://internal.example/secret"}
            self.utils.safe_request("GET", "https://cdn.example/a.png", timeout=5)
        self.assertEqual(1, request.call_count)


if __name__ == "__main__":
    unittest.main()
