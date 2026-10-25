import os
from datetime import datetime, timedelta, timezone
import jwt
from pwdlib import PasswordHash
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from .models import User
password_hash=PasswordHash.recommended()
bearer=HTTPBearer(auto_error=False)
JWT_SECRET=os.getenv("JWT_SECRET", "unsafe-development-secret-change-me")
JWT_EXPIRE_MINUTES=int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
def hash_password(password:str)->str: return password_hash.hash(password)
def verify_password(password:str, hashed:str)->bool: return password_hash.verify(password, hashed)
def create_access_token(user_id:int)->str:
    return jwt.encode({"sub":str(user_id),"exp":datetime.now(timezone.utc)+timedelta(minutes=JWT_EXPIRE_MINUTES)}, JWT_SECRET, algorithm="HS256")
def current_user(credentials:HTTPAuthorizationCredentials|None=Depends(bearer), db:Session=Depends(get_db))->User:
    if not credentials: raise HTTPException(401,"Sign in required",headers={"WWW-Authenticate":"Bearer"})
    try:
        payload=jwt.decode(credentials.credentials,JWT_SECRET,algorithms=["HS256"]); user_id=int(payload["sub"])
    except (jwt.PyJWTError,KeyError,ValueError): raise HTTPException(401,"Invalid or expired access token")
    user=db.get(User,user_id)
    if not user: raise HTTPException(401,"Account no longer exists")
    return user
