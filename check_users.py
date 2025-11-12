import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_users():
    client = AsyncIOMotorClient('mongodb://mongodb:27017')
    db = client['la_segunda']
    cursor = db.users.find()
    users = [u async for u in cursor]
    print(f'Total usuarios: {len(users)}')
    for u in users:
        print(f"  - {u.get('name')} (id: {u.get('_id')})")

if __name__ == "__main__":
    asyncio.run(check_users())

