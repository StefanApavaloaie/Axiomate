from pydantic import BaseModel

class GoogleCallbackResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str="bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"