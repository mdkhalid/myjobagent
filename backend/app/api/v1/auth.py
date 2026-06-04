from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

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


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user with role-specific fields.

    Supports three roles:
    - jobseeker: looking for jobs
    - company: looking to hire talent
    - admin: platform administrator
    """
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
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
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
