from httpx import AsyncClient

from app.config import settings
from app.core.exceptions import UnauthorizedException


async def verify_google_oauth_code(code: str) -> dict:
    """
    Exchanges the authorization code for an access token, 
    then fetches the user profile directly from Google.
    """
    token_url = "https://oauth2.googleapis.com/token"

    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    async with AsyncClient() as client:
        # 1. Exchange the code for an access token
        response = await client.post(token_url, data=data)

        if response.status_code != 200:
            raise UnauthorizedException("Failed to exchange code with Google")

        token_data = response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            raise UnauthorizedException("No access token returned from Google")

        # 2. Use the access token to fetch the user's profile
        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if userinfo_res.status_code != 200:
            raise UnauthorizedException("Failed to fetch user profile from Google")

        return userinfo_res.json()
