from minio import Minio
from minio.error import S3Error
from app.config import settings
import os
from datetime import timedelta

class StorageManager:
    _internal_client = None
    _public_client = None

    @classmethod
    def get_internal_client(cls):
        """Client for backend operations (Upload, Delete, List) inside Docker network"""
        if cls._internal_client is None:
            cls._internal_client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE,
                region="us-east-1"
            )
            try:
                if not cls._internal_client.bucket_exists(settings.MINIO_BUCKET_NAME):
                    cls._internal_client.make_bucket(settings.MINIO_BUCKET_NAME)
                    print(f"Bucket {settings.MINIO_BUCKET_NAME} created")
            except Exception as e:
                print(f"Error checking/creating bucket: {e}")
        return cls._internal_client

    @classmethod
    def get_public_client(cls):
        """Client ONLY for generating Presigned URLs compatible with Browser (localhost)"""
        if cls._public_client is None:
            cls._public_client = Minio(
                settings.MINIO_PUBLIC_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE,
                region="us-east-1"
            )
        return cls._public_client

    @staticmethod
    def upload_file(file_path: str, object_name: str = None, content_type: str = "application/octet-stream"):
        try:
            client = StorageManager.get_internal_client()
            if object_name is None:
                object_name = os.path.basename(file_path)
            
            client.fput_object(
                settings.MINIO_BUCKET_NAME,
                object_name,
                file_path,
                content_type=content_type
            )
            return object_name
        except Exception as e:
            print(f"MinIO Upload Error: {e}")
            return None

    @staticmethod
    def list_files(page: int = 1, limit: int = 20, search: str = None, file_type: str = None, chat_id: str = None):
        try:
            internal = StorageManager.get_internal_client()
            public = StorageManager.get_public_client()
            
            # List all objects recursively
            # Note: For massive buckets, this should be optimized or cached in DB
            objects = internal.list_objects(settings.MINIO_BUCKET_NAME, recursive=True)
            
            all_files = []
            unique_chats = set()

            # Filter and Process
            for obj in objects:
                # Structure: session_id/chat_id/filename
                parts = obj.object_name.split('/')
                if len(parts) >= 3:
                    file_chat_id = parts[1]
                    file_name = parts[-1]
                    unique_chats.add(file_chat_id)

                    # 1. Filter by Chat ID (Group)
                    if chat_id and chat_id != file_chat_id:
                        continue
                    
                    # 2. Filter by Search Name
                    if search and search.lower() not in file_name.lower():
                        continue

                    # 3. Filter by File Type
                    if file_type:
                        ext = file_name.split('.')[-1].lower() if '.' in file_name else ''
                        is_match = False
                        if file_type == 'image' and ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']: is_match = True
                        elif file_type == 'video' and ext in ['mp4', 'mov', 'avi', 'mkv', 'webm']: is_match = True
                        elif file_type == 'document' and ext in ['pdf', 'doc', 'docx', 'txt', 'csv', 'xlsx']: is_match = True
                        elif file_type == 'other' and not is_match: is_match = True # Simplified logic
                        
                        if not is_match:
                            continue

                    # Generate Public URL
                    url = public.get_presigned_url(
                        "GET",
                        settings.MINIO_BUCKET_NAME,
                        obj.object_name,
                        expires=timedelta(hours=1)
                    )
                    
                    all_files.append({
                        "name": obj.object_name,
                        "file_name": file_name,
                        "chat_id": file_chat_id,
                        "size": obj.size,
                        "last_modified": obj.last_modified,
                        "url": url,
                        "is_dir": obj.is_dir
                    })

            # Sort by newest first
            all_files.sort(key=lambda x: x['last_modified'], reverse=True)

            # Pagination Logic
            total = len(all_files)
            start = (page - 1) * limit
            end = start + limit
            paginated_files = all_files[start:end]

            return {
                "files": paginated_files,
                "total": total,
                "page": page,
                "limit": limit,
                "total_pages": (total + limit - 1) // limit,
                "groups": list(unique_chats) # Return available groups for filter
            }

        except Exception as e:
            print(f"MinIO List Error: {e}")
            return {"files": [], "total": 0, "page": 1, "limit": limit, "groups": []}

    @staticmethod
    def delete_file(object_name: str):
        try:
            client = StorageManager.get_internal_client()
            client.remove_object(settings.MINIO_BUCKET_NAME, object_name)
            return True
        except Exception as e:
            print(f"MinIO Delete Error: {e}")
            return False

    @staticmethod
    def get_file_url(object_name: str):
        try:
            client = StorageManager.get_public_client()
            return client.get_presigned_url(
                "GET",
                settings.MINIO_BUCKET_NAME,
                object_name,
                expires=timedelta(hours=1)
            )
        except Exception as e:
            print(f"MinIO URL Error: {e}")
            return None