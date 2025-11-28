from minio import Minio
from minio.deleteobjects import DeleteObject
from minio.error import S3Error
from app.config import settings
import os
from datetime import timedelta

class StorageManager:
    _internal_client = None
    _public_client = None

    @classmethod
    def get_internal_client(cls):
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
            except Exception as e:
                print(f"Error checking/creating bucket: {e}")
        return cls._internal_client

    @classmethod
    def get_public_client(cls):
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
            client.fput_object(settings.MINIO_BUCKET_NAME, object_name, file_path, content_type=content_type)
            return object_name
        except Exception as e:
            print(f"MinIO Upload Error: {e}")
            return None

    @staticmethod
    def list_files(prefix: str = ""):
        return []

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
    def delete_multiple_files(object_names: list[str]):
        try:
            client = StorageManager.get_internal_client()
            objects = [DeleteObject(name) for name in object_names]
            errors = client.remove_objects(settings.MINIO_BUCKET_NAME, objects)
            for error in errors: print(f"Error deleting object: {error}")
            return True
        except Exception as e:
            print(f"MinIO Bulk Delete Error: {e}")
            return False

    @staticmethod
    def get_file_url(object_name: str):
        try:
            client = StorageManager.get_public_client()
            return client.get_presigned_url("GET", settings.MINIO_BUCKET_NAME, object_name, expires=timedelta(hours=1))
        except Exception as e:
            print(f"MinIO URL Error: {e}")
            return None