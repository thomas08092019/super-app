from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, distinct
from app.database import get_db
from app.models import User, DownloadedFile
from app.dependencies import get_current_user
from app.storage_service import StorageManager
from typing import Optional

router = APIRouter(prefix="/storage", tags=["Storage"])

@router.get("/files")
async def list_files(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    file_type: Optional[str] = None,
    chat_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List files from DB with pagination, search, and filters
    """
    # 1. Build Query
    query = select(DownloadedFile)
    
    if chat_id:
        query = query.where(DownloadedFile.chat_id == chat_id)
    
    if file_type:
        query = query.where(DownloadedFile.file_type == file_type)
        
    if search:
        query = query.where(DownloadedFile.file_name.ilike(f"%{search}%"))
    
    # 2. Get Total Count (for pagination)
    # Note: efficient count in async sqlalchemy is a bit verbose, 
    # for simplicity we fetch all matches IDs or use a separate count query
    # Here we just execute and len() for simple scale, or use func.count()
    from sqlalchemy import func
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # 3. Get Groups for Filter Dropdown
    groups_query = select(distinct(DownloadedFile.chat_id), DownloadedFile.chat_name)
    groups_result = await db.execute(groups_query)
    groups = [{"id": row[0], "name": row[1] or "Unknown Group"} for row in groups_result.all()]

    # 4. Pagination & Ordering
    query = query.order_by(desc(DownloadedFile.created_at))
    query = query.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(query)
    files = result.scalars().all()
    
    # 5. Format Response with Presigned URLs
    formatted_files = []
    for f in files:
        url = StorageManager.get_file_url(f.file_path)
        formatted_files.append({
            "id": f.id,
            "name": f.file_path,
            "file_name": f.file_name,
            "chat_id": f.chat_id,
            "chat_name": f.chat_name or "Unknown",
            "size": f.file_size,
            "last_modified": f.created_at.isoformat(),
            "url": url,
            "type": f.file_type
        })

    return {
        "files": formatted_files,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "groups": groups
    }

@router.delete("/files/{file_id}")
async def delete_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get file record
    result = await db.execute(select(DownloadedFile).where(DownloadedFile.id == file_id))
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete from MinIO
    StorageManager.delete_file(file_record.file_path)
    
    # Delete from DB
    await db.delete(file_record)
    await db.commit()
    
    return {"message": "File deleted successfully"}