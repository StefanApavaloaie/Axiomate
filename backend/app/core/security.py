import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings

#jwt
def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token. subject = user UUID (as string)."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str) -> str:
    """Create a longer-lived refresh token."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and verify a JWT token.
    Raises JWTError if invalid or expired.
    Returns the full payload dict.
    """
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )


#api keys
def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.

    Returns a tuple of (raw_key, key_hash, key_prefix):
    - raw_key   : shown to the user ONCE, never stored
    - key_hash  : SHA-256 hash stored in the database
    - key_prefix: short display string e.g. "axm_live_a1b2c3"
    """
    raw_key = f"axm_live_{secrets.token_urlsafe(32)}"
    key_hash = hash_api_key(raw_key)
    key_prefix = raw_key[:16]
    return raw_key, key_hash, key_prefix


def hash_api_key(raw_key: str) -> str:
    """SHA-256 hash of an API key. Used for DB storage and lookup."""
    return hashlib.sha256(raw_key.encode()).hexdigest()
