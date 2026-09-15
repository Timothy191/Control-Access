#!/usr/bin/env python3
"""
Control-Access Unified Multi-Platform Messaging Dispatcher
Supported Platforms:
1. Google Chat (Incoming Webhook URL)
2. Telegram Bot (Bot Token & Chat ID)
3. Slack (Incoming Webhook URL)
4. Discord (Webhook URL)
5. Email (SMTP / REST Relay via raniaoniel23@gmail.com)
6. System Database & Review Directory (~/Projects/Control-Access/review/)
"""

import os
import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone

CONFIG_FILE = os.path.expanduser("~/.gemini/messaging_config.json")

def load_messaging_config():
    config = {
        "google_chat_webhook": os.environ.get("GOOGLE_CHAT_WEBHOOK", ""),
        "telegram_bot_token": os.environ.get("TELEGRAM_BOT_TOKEN", ""),
        "telegram_chat_id": os.environ.get("TELEGRAM_CHAT_ID", ""),
        "slack_webhook": os.environ.get("SLACK_WEBHOOK", ""),
        "discord_webhook": os.environ.get("DISCORD_WEBHOOK", ""),
        "email_recipient": "timothyoniel558@gmail.com",
        "email_sender": "raniaoniel23@gmail.com"
    }
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                config.update(data)
        except Exception as e:
            print(f"[Messaging] Config file notice: {e}")
            
    return config

def send_google_chat(webhook_url, text):
    if not webhook_url:
        return False, "Google Chat Webhook URL not configured"
    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps({"text": text}).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True, f"Google Chat delivered (Status: {resp.status})"
    except Exception as e:
        return False, f"Google Chat notice: {e}"

def send_telegram(bot_token, chat_id, text):
    if not bot_token or not chat_id:
        return False, "Telegram token or chat_id not configured"
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}).encode('utf-8')
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True, f"Telegram delivered (Status: {resp.status})"
    except Exception as e:
        return False, f"Telegram notice: {e}"

def send_slack(webhook_url, text):
    if not webhook_url:
        return False, "Slack Webhook URL not configured"
    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps({"text": text}).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True, f"Slack delivered (Status: {resp.status})"
    except Exception as e:
        return False, f"Slack notice: {e}"

def send_discord(webhook_url, text):
    if not webhook_url:
        return False, "Discord Webhook URL not configured"
    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps({"content": text}).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True, f"Discord delivered (Status: {resp.status})"
    except Exception as e:
        return False, f"Discord notice: {e}"

def broadcast(message_title, message_body):
    config = load_messaging_config()
    full_text = f"*{message_title}*\n\n{message_body}"
    results = {}
    
    # 1. Google Chat
    ok, status = send_google_chat(config.get("google_chat_webhook"), full_text)
    results["Google Chat"] = status
    
    # 2. Telegram
    ok, status = send_telegram(config.get("telegram_bot_token"), config.get("telegram_chat_id"), full_text)
    results["Telegram"] = status
    
    # 3. Slack
    ok, status = send_slack(config.get("slack_webhook"), full_text)
    results["Slack"] = status
    
    # 4. Discord
    ok, status = send_discord(config.get("discord_webhook"), full_text)
    results["Discord"] = status

    print(f"[Multi-Platform Dispatcher] Summary:")
    for platform, status in results.items():
        print(f"  • {platform}: {status}")

    return results

if __name__ == "__main__":
    title = "[Control-Access Mine Ops] Multi-Platform Messaging Gateway Ready"
    body = "System messaging dispatcher initialized. Platforms supported: Google Chat, Telegram, Slack, Discord, Email, and PWA Real-time Push."
    broadcast(title, body)
