"""Unit tests for network listeners and scanner processing services."""
import unittest
from unittest.mock import MagicMock, patch

from database import db_session
from models import Device
from services.listeners import (
    _ensure_device_exists,
    get_broadcast_address,
    optimize_socket_buffers,
    process_scan_data,
    start_packet_sniffer,
    start_udp_listener,
)


class TestListeners(unittest.TestCase):
    def setUp(self):
        # Clean up devices
        db_session.query(Device).delete()
        db_session.commit()

    def tearDown(self):
        db_session.query(Device).delete()
        db_session.commit()

    def test_get_broadcast_address(self):
        addr = get_broadcast_address()
        self.assertIsInstance(addr, str)
        self.assertTrue(len(addr) > 0)

    def test_optimize_socket_buffers(self):
        # Should not raise exception
        optimize_socket_buffers()

    def test_ensure_device_exists_new_and_existing(self):
        test_ip = "192.168.1.150"
        # First time: creates device
        _ensure_device_exists(test_ip)
        device = db_session.query(Device).filter_by(ip_address=test_ip).first()
        self.assertIsNotNone(device)
        self.assertEqual(device.status, "pending")
        self.assertEqual(device.device_name, f"Scanner-{test_ip}")

        # Second time: updates existing device
        _ensure_device_exists(test_ip)
        db_session.refresh(device)
        self.assertIsNotNone(device.last_seen)

    def test_process_scan_data_invalid_payload(self):
        # Too short or empty
        res = process_scan_data("", "192.168.1.50")
        self.assertIsNone(res)

        res = process_scan_data("a", "192.168.1.50")
        self.assertIsNone(res)

    def test_process_scan_data_valid(self):
        callback_mock = MagicMock(return_value={
            "access_granted": True,
            "denial_reason": "Access Granted",
            "entity_type": "employee",
            "entity_name": "John Doe"
        })
        socketio_mock = MagicMock()

        res = process_scan_data(
            "EMP001",
            "192.168.1.100",
            protocol="UDP",
            process_qr_callback=callback_mock,
            socketio_instance=socketio_mock
        )

        self.assertIsNotNone(res)
        self.assertTrue(res["access_granted"])
        callback_mock.assert_called_once()
        socketio_mock.emit.assert_called_once()

        # Verify device was auto-created
        device = db_session.query(Device).filter_by(ip_address="192.168.1.100").first()
        self.assertIsNotNone(device)

    @patch("services.listeners.scanner_listener_running", True)
    @patch("socket.socket")
    def test_start_udp_listener(self, mock_socket_cls):
        mock_sock = MagicMock()
        mock_socket_cls.return_value = mock_sock

        # We can set scanner_listener_running to False immediately or test thread start
        import services.listeners as sl
        sl.scanner_listener_running = False

        thread = start_udp_listener(5000)
        self.assertIsNotNone(thread)
        thread.join(timeout=1.0)

    @patch("services.listeners.os.geteuid", return_value=1000) # Non-root
    def test_packet_sniffer_non_root(self, mock_geteuid):
        res = start_packet_sniffer()
        self.assertIsNone(res)
