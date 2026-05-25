"""
Secure LinkedIn Configuration Service
Handles encryption and storage of LinkedIn credentials
"""

import os
import json
import logging
from typing import Dict, Optional, Any
from cryptography.fernet import Fernet
import base64

logger = logging.getLogger(__name__)

class LinkedInConfigManager:
    """Secure manager for LinkedIn configurations"""

    def __init__(self):
        self.fernet_key = self._get_or_create_key()
        self.fernet = Fernet(self.fernet_key)

    def _get_or_create_key(self) -> bytes:
        """Get or create encryption key"""
        # In production, this should come from environment variables or secure storage
        key_file = ".linkedin_encryption_key"

        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return f.read()
        else:
            # Generate new key
            key = Fernet.generate_key()
            with open(key_file, 'wb') as f:
                f.write(key)
            # Set restrictive permissions
            os.chmod(key_file, 0o600)
            return key

    def encrypt_config(self, config: Dict[str, Any]) -> str:
        """Encrypt LinkedIn configuration"""
        try:
            # Convert to JSON string
            config_str = json.dumps(config)
            # Encrypt
            encrypted = self.fernet.encrypt(config_str.encode())
            # Return as base64 string for storage
            return base64.b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"Error encrypting config: {e}")
            raise

    def decrypt_config(self, encrypted_str: str) -> Dict[str, Any]:
        """Decrypt LinkedIn configuration"""
        try:
            # Decode from base64
            encrypted = base64.b64decode(encrypted_str.encode())
            # Decrypt
            decrypted = self.fernet.decrypt(encrypted)
            # Parse JSON
            return json.loads(decrypted.decode())
        except Exception as e:
            logger.error(f"Error decrypting config: {e}")
            raise

    def save_user_config(self, user_id: int, config: Dict[str, Any]) -> None:
        """Save user's LinkedIn configuration securely"""
        try:
            # Encrypt the configuration
            encrypted = self.encrypt_config(config)

            # Save to user-specific file
            config_dir = ".linkedin_configs"
            os.makedirs(config_dir, exist_ok=True)

            config_file = os.path.join(config_dir, f"user_{user_id}.enc")
            with open(config_file, 'w') as f:
                f.write(encrypted)

            # Set restrictive permissions
            os.chmod(config_file, 0o600)

            logger.info(f"Saved LinkedIn config for user {user_id}")

        except Exception as e:
            logger.error(f"Error saving user config: {e}")
            raise

    def get_user_config(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user's LinkedIn configuration"""
        try:
            config_file = os.path.join(".linkedin_configs", f"user_{user_id}.enc")

            if not os.path.exists(config_file):
                return None

            with open(config_file, 'r') as f:
                encrypted = f.read()

            # Decrypt
            return self.decrypt_config(encrypted)

        except Exception as e:
            logger.error(f"Error getting user config: {e}")
            return None

    def delete_user_config(self, user_id: int) -> bool:
        """Delete user's LinkedIn configuration"""
        try:
            config_file = os.path.join(".linkedin_configs", f"user_{user_id}.enc")

            if os.path.exists(config_file):
                os.remove(config_file)
                logger.info(f"Deleted LinkedIn config for user {user_id}")
                return True

            return False

        except Exception as e:
            logger.error(f"Error deleting user config: {e}")
            return False

# Global instance
linkedin_config_manager = LinkedInConfigManager()