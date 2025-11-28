"""
Database seeding script
Automatically creates default admin and user accounts on first run
"""
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal, init_db
from app.models import User, UserRole, UserStatus
from app.auth import hash_password


async def seed_database():
    """
    Seed the database with default users if they don't exist
    """
    print("🌱 Starting database seeding...")
    
    # Initialize database tables
    await init_db()
    print("✅ Database tables initialized")
    
    async with AsyncSessionLocal() as session:
        # Check if any users exist
        result = await session.execute(select(User))
        existing_users = result.scalars().all()
        
        if existing_users:
            print(f"ℹ️  Found {len(existing_users)} existing users. Skipping seed.")
            return
        
        print("📝 Creating default users...")
        
        # Create admin user
        admin_user = User(
            username="admin",
            email="admin@example.com",
            hashed_password=hash_password("admin123"),
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE
        )
        session.add(admin_user)
        print("✅ Created admin user: admin@example.com (password: admin123)")
        
        # Create regular user
        regular_user = User(
            username="user",
            email="user@example.com",
            hashed_password=hash_password("user123"),
            role=UserRole.USER,
            status=UserStatus.ACTIVE
        )
        session.add(regular_user)
        print("✅ Created regular user: user@example.com (password: user123)")
        
        # Commit changes
        await session.commit()
        print("🎉 Database seeding completed successfully!")
        print("\n⚠️  SECURITY WARNING: Change default passwords in production!")


if __name__ == "__main__":
    asyncio.run(seed_database())

