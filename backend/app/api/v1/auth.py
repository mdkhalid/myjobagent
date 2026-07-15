from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from collections import defaultdict
import time

from app.db.session import get_db
from app.core.security import (
    verify_password, 
    get_password_hash, 
    create_access_token,
    get_current_user
)
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token, UserUpdate
from app.config import settings

router = APIRouter()
security = HTTPBearer()

# In-memory rate limiting (use Redis in production for distributed systems)
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 10  # max requests per window


def _check_rate_limit(request_key: str, max_requests: int = RATE_LIMIT_MAX_REQUESTS, window: int = RATE_LIMIT_WINDOW):
    """Check and enforce rate limiting for a given key."""
    now = time.time()
    # Clean old entries outside the window
    _rate_limit_store[request_key] = [
        timestamp for timestamp in _rate_limit_store[request_key]
        if now - timestamp < window
    ]
    
    if len(_rate_limit_store[request_key]) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again in {window} seconds.",
            headers={"Retry-After": str(window)}
        )
    
    _rate_limit_store[request_key].append(now)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user with role-specific fields.

    Supports two roles:
    - jobseeker: looking for jobs
    - company: looking to hire talent
    
    Note: Admin accounts must be created through the admin panel or CLI.
    """
    # Rate limit by IP address
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"register:{client_ip}", max_requests=5, window=300)  # 5 registrations per 5 minutes
    
    # Prevent self-registration as admin
    if user_data.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be self-registered. Contact system administrator."
        )
    
    # Validate role-specific required fields
    if user_data.role == UserRole.COMPANY:
        if not user_data.company_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Company name is required for company accounts"
            )

    # Check if user exists
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user with role-specific fields
    hashed_password = get_password_hash(user_data.password)
    user_kwargs = {
        "email": user_data.email,
        "hashed_password": hashed_password,
        "full_name": user_data.full_name,
        "role": user_data.role,
    }

    # Set role-specific fields
    if user_data.role == UserRole.COMPANY:
        user_kwargs.update({
            "company_name": user_data.company_name,
            "company_website": user_data.company_website,
            "company_size": user_data.company_size,
            "industry": user_data.industry,
            "company_description": user_data.company_description,
        })
    elif user_data.role == UserRole.JOBSEEKER:
        user_kwargs.update({
            "phone": user_data.phone,
            "location": user_data.location,
            "headline": user_data.headline,
            "linkedin_url": user_data.linkedin_url,
            "portfolio_url": user_data.portfolio_url,
        })

    new_user = User(**user_kwargs)

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=Token)
async def login(request: Request, user_data: UserLogin, db: Session = Depends(get_db)):
    # Rate limit by IP address
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"login:{client_ip}", max_requests=10, window=60)  # 10 attempts per minute
    
    # Find user
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
