
from fastapi import Header, HTTPException
from app.utils.auth import decode_token, create_access_token
from fastapi import APIRouter, HTTPException, Header
from app.database.db import users_collection
from app.utils.auth import hash_password, verify_password, create_access_token, decode_token
from pydantic import BaseModel

router = APIRouter()

class UserSchema(BaseModel):
    email: str
    password: str
"""
Add this endpoint to app/routes/auth.py

It re-issues a fresh 24-hour token as long as the old one is still valid
and not yet expired. If the token is already expired, returns 401.
"""

# ── paste this block into your existing auth router ──────────────────────────

@router.post("/refresh")
def refresh_token(authorization: str = Header(...)):
    """
    Re-issues a fresh token.
    Client should call this proactively (e.g. on app focus / every 12h).
    Returns 401 if the current token is already expired.
    """
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)          # returns None if expired or invalid
    if not email:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

    new_token = create_access_token({"sub": email})
    return {"token": new_token, "email": email}
@router.post("/signup")
def signup(user: UserSchema):
    existing = users_collection.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(user.password)
    users_collection.insert_one({
        "email": user.email,
        "password": hashed,
         "plan": "free",
    "ai_queries_today": 0,
    "ai_queries_date": "",
    "subscribed_at": None
    })
    return {"message": "Account created successfully"}

@router.post("/login")
def login(user: UserSchema):
    existing = users_collection.find_one({"email": user.email})
    if not existing:
        raise HTTPException(status_code=400, detail="Email not found")

    if not verify_password(user.password, existing["password"]):
        raise HTTPException(status_code=400, detail="Incorrect password")

    token = create_access_token({"sub": user.email})
    return {"token": token, "email": user.email}

@router.get("/me")
def get_me(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"email": email}

@router.delete("/clear-users")
def clear_users():
    users_collection.delete_many({})
    return {"message": "Users cleared"}