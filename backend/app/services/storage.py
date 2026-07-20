import httpx
from typing import Optional
from app.config import settings

class StorageService:
    def __init__(self):
        self.enabled = bool(settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY))
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
        self.bucket = settings.SUPABASE_BUCKET

    async def upload_file(self, file_name: str, file_bytes: bytes, mime_type: str) -> Optional[str]:
        if not self.enabled:
            return None
        
        # Clean file name to prevent path traversal issues
        safe_name = "".join(c for c in file_name if c.isalnum() or c in "._-")
        base_url = self.url.rstrip("/")
        upload_url = f"{base_url}/storage/v1/object/{self.bucket}/{safe_name}"
        
        headers = {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key,
            "Content-Type": mime_type
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(upload_url, content=file_bytes, headers=headers)
            if response.status_code == 200:
                # Return the public URL of the uploaded file
                return f"{base_url}/storage/v1/object/public/{self.bucket}/{safe_name}"
            else:
                print(f"Supabase upload failed: {response.status_code} - {response.text}")
                return None

    async def delete_file(self, file_path_or_name: str) -> bool:
        if not self.enabled:
            return False
        
        # Extract filename if a full URL or path was provided
        file_name = file_path_or_name.split("/")[-1]
        safe_name = "".join(c for c in file_name if c.isalnum() or c in "._-")
        
        base_url = self.url.rstrip("/")
        delete_url = f"{base_url}/storage/v1/object/{self.bucket}/{safe_name}"
        
        headers = {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(delete_url, headers=headers)
            return response.status_code == 200

storage_service = StorageService()
