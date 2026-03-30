from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import UnauthorizedException
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import GoogleCallbackResponse, RefreshTokenRequest, TokenResponse
from app.services.auth_service import verify_google_oauth_code

router = APIRouter(prefix="/auth")


@router.get("/google")
async def google_login():
    """Redirects the frontend (or user) to Google's OAuth 2.0 consent screen."""
    client_id = settings.GOOGLE_CLIENT_ID
    redirect_uri = settings.GOOGLE_REDIRECT_URI
    scope = "openid email profile"

    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"response_type=code&client_id={client_id}&redirect_uri={redirect_uri}"
        f"&scope={scope}&access_type=offline&prompt=consent"
    )
    return RedirectResponse(url)


@router.get("/google/callback", response_model=GoogleCallbackResponse)
async def google_callback(code: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Handles the Google redirect, verifies the code, and creates/logs in the user."""
    # 1. Exchange the code with Google
    user_info = await verify_google_oauth_code(code)

    email = user_info.get("email")
    google_sub = user_info.get("sub")
    name = user_info.get("name")
    avatar_url = user_info.get("picture")

    if not email or not google_sub:
        raise UnauthorizedException("Incomplete user profile returned from Google")

    # 2. Find existing user or create a new one
    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            google_sub=google_sub,
            name=name,
            avatar_url=avatar_url,
        )
        db.add(user)
        # Flush to get the UUID generated without closing the transaction
        await db.flush()
    else:
        # Update profile info if it changed on Google
        user.name = name
        user.avatar_url = avatar_url

    # 3. Generate our own JWTs
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    return GoogleCallbackResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(request: RefreshTokenRequest):
    """Issues a fresh access token if the provided refresh token is valid."""
    try:
        payload = decode_token(request.refresh_token)
        if payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid token type")

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedException("Invalid token payload")

        new_access_token = create_access_token(user_id)
        return TokenResponse(access_token=new_access_token)
    except JWTError:
        raise UnauthorizedException("Invalid or expired refresh token")


@router.get("/me")
async def get_current_user_profile(user: User = Depends(get_current_user)):
    """Returns the profile of the currently logged-in user."""
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
    }
