"""
TextBee SMS Service — clean rewrite
Sends OTP via TextBee Android gateway (https://textbee.dev)
"""
import requests
import logging

logger = logging.getLogger(__name__)

TEXTBEE_API_URL = 'https://api.textbee.dev/api/v1/gateway/devices/{device_id}/send-sms'


def send_otp_sms(api_key: str, device_id: str, phone: str, otp_code: str) -> dict:
    """
    Send OTP SMS via TextBee.

    Returns:
        {'success': True}  on success
        {'success': False, 'error': '...'}  on failure
    """
    if not api_key or not device_id:
        logger.error("TextBee credentials missing — check TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID in .env")
        return {'success': False, 'error': 'SMS service not configured.'}

    url     = TEXTBEE_API_URL.format(device_id=device_id)
    headers = {'x-api-key': api_key, 'Content-Type': 'application/json'}
    message = (
        f"Your HVID verification code is: {otp_code}\n"
        f"Valid for 20 minutes. Do not share this code."
    )
    payload = {
        'recipients': [phone],
        'message':    message,
    }

    logger.info(f"TextBee: sending OTP to {phone[:5]}***{phone[-2:]}")

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=15)
        body = {}
        try:
            body = resp.json()
        except Exception:
            body = {'raw': resp.text}

        if resp.status_code in (200, 201):
            logger.info(f"TextBee: queued successfully -> {body}")
            return {'success': True, 'data': body}

        logger.error(f"TextBee: failed [{resp.status_code}] -> {body}")
        return {
            'success': False,
            'error': body.get('message') or f'TextBee error {resp.status_code}',
        }

    except requests.exceptions.Timeout:
        logger.error("TextBee: request timed out")
        return {'success': False, 'error': 'SMS gateway timed out.'}

    except requests.exceptions.ConnectionError as e:
        logger.error(f"TextBee: connection error — {e}")
        return {'success': False, 'error': 'Cannot reach SMS gateway.'}

    except Exception as e:
        logger.exception(f"TextBee: unexpected error — {e}")
        return {'success': False, 'error': 'Unexpected SMS error.'}
