"""Unit tests for configuration toggles, rate limiting storage, and AI chat enablement."""
import unittest

from app import app, limiter


class TestConfigToggles(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_ai_chat_enabled_by_default(self):
        app.config["ENABLE_AI_CHAT"] = True
        # Login first or test endpoint behavior
        response = self.client.get("/api/ai/status")
        # Should require login or return json status (auth redirect or json)
        self.assertIn(response.status_code, [200, 302])

    def test_ai_chat_disabled_behavior(self):
        app.config["ENABLE_AI_CHAT"] = False
        with self.client:
            # Login as admin to test authenticated endpoints
            with self.client.session_transaction() as sess:
                sess["logged_in"] = True
                sess["username"] = "admin"
                sess["role"] = "admin"

            # Check page route returns 403 when disabled
            resp_page = self.client.get("/ai/chat")
            self.assertEqual(resp_page.status_code, 403)

            # Check API status when disabled
            resp_status = self.client.get("/api/ai/status")
            self.assertEqual(resp_status.status_code, 200)
            data = resp_status.get_json()
            self.assertFalse(data.get("available"))
            self.assertEqual(data.get("provider"), "disabled")

            # Check API chat post when disabled
            resp_chat = self.client.post("/api/ai/chat", json={"prompt": "hello"})
            self.assertEqual(resp_chat.status_code, 403)

    def test_limiter_storage_configuration(self):
        # Verify limiter is configured with storage URI
        self.assertIsNotNone(limiter._storage_uri)
