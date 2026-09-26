"""Transactional email over SMTP. Sending is skipped (and logged) when SMTP is not configured."""

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import make_msgid

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(get_settings().smtp_host)


def _send_blocking(to: str, subject: str, text: str, reply_to: str | None) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message["Message-ID"] = make_msgid(domain="clave.app")
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(text)

    context = ssl.create_default_context()
    if settings.smtp_port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=20) as server:
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
        if settings.smtp_use_tls:
            server.starttls(context=context)
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)


async def send(to: str, subject: str, text: str, reply_to: str | None = None) -> bool:
    """Returns True when the email was handed to the SMTP server."""
    if not is_configured() or not to:
        logger.info("Email not sent (SMTP not configured): %s", subject)
        return False
    try:
        await asyncio.to_thread(_send_blocking, to, subject, text, reply_to)
        return True
    except (smtplib.SMTPException, OSError) as exc:
        logger.error("Sending email '%s' failed: %s", subject, exc)
        return False
