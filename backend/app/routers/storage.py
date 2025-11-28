from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, distinct, delete, func
from app.database import get_db
from app.models import User, DownloadedFile
from app.dependencies import get_current_user
from app.storage_service import StorageManager
from typing import Optional, List

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
    query = select(DownloadedFile)
    if chat_id: query = query.where(DownloadedFile.chat_id == chat_id)
    if file_type: query = query.where(DownloadedFile.file_type == file_type)
    if search: query = query.where(DownloadedFile.file_name.ilike(f"%{search}%"))
    
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    groups_query = select(distinct(DownloadedFile.chat_id), DownloadedFile.chat_name)
    groups_result = await db.execute(groups_query)
    groups = [{"id": row[0], "name": row[1] or "Unknown Group"} for row in groups_result.all()]

    query = query.order_by(desc(DownloadedFile.created_at)).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    files = result.scalars().all()
    
    formatted_files = []
    for f in files:
        url = StorageManager.get_file_url(f.file_path)
        formatted_files.append({
            "id": f.id, "name": f.file_path, "file_name": f.file_name,
            "chat_id": f.chat_id, "chat_name": f.chat_name or "Unknown",
            "size": f.file_size, "last_modified": f.created_at.isoformat(),
            "url": url, "type": f.file_type
        })

    return {"files": formatted_files, "total": total, "page": page, "limit": limit, "total_pages": (total + limit - 1) // limit if limit > 0 else 1, "groups": groups}

@router.delete("/files/batch")
async def delete_files_batch(
    file_ids: List[int] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(DownloadedFile).where(DownloadedFile.id.in_(file_ids)))
    files = result.scalars().all()
    if not files: return {"message": "No files found"}
    object_names = [f.file_path for f in files]
    StorageManager.delete_multiple_files(object_names)
    await db.execute(delete(DownloadedFile).where(DownloadedFile.id.in_(file_ids)))
    await db.commit()
    return {"message": f"Deleted {len(files)} files"}

@router.delete("/files/all")
async def delete_all_files(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(DownloadedFile))
    files = result.scalars().all()
    if not files: return {"message": "No files to delete"}
    object_names = [f.file_path for f in files]
    StorageManager.delete_multiple_files(object_names)
    await db.execute(delete(DownloadedFile))
    await db.commit()
    return {"message": "All files deleted"}

@router.delete("/files/{file_id}")
async def delete_file(file_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(DownloadedFile).where(DownloadedFile.id == file_id))
    file_record = result.scalar_one_or_none()
    if not file_record: raise HTTPException(status_code=404, detail="File not found")
    StorageManager.delete_file(file_record.file_path)
    await db.delete(file_record)
    await db.commit()
    return {"message": "Deleted"}