from fastapi import FastAPI
import socketio
import uvicorn
from datetime import datetime
from typing import Dict

app = FastAPI()

sio = socketio.AsyncServer(
    async_mode='asgi', 
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=False
)

socket_app = socketio.ASGIApp(sio, app)

# เก็บข้อมูล: {socket_id: group_id}
user_groups: Dict[str, str] = {}

# เก็บ location แยกตาม group: {group_id: {socket_id: location_data}}
group_locations: Dict[str, Dict[str, dict]] = {}

@app.get("/api/status")
async def get_status():
    groups_info = {}
    for group_id, locations in group_locations.items():
        groups_info[group_id] = len(locations)
    
    return {
        "status": "online",
        "total_users": len(user_groups),
        "groups": groups_info
    }

@sio.event
async def connect(sid, environ):
    client_ip = environ.get('REMOTE_ADDR', 'unknown')
    print(f'✅ Client connected: {sid} from {client_ip}')

@sio.event
async def disconnect(sid):
    print(f'❌ Client disconnected: {sid}')
    
    # ถ้าอยู่ใน group ให้ออกจาก group
    if sid in user_groups:
        group_id = user_groups[sid]
        await handle_leave_group(sid, group_id)

async def handle_leave_group(sid, group_id):
    """ฟังก์ชันช่วยสำหรับออกจาก group"""
    # ลบออกจาก room
    await sio.leave_room(sid, group_id)
    
    # ลบข้อมูล
    if sid in user_groups:
        del user_groups[sid]
    
    if group_id in group_locations and sid in group_locations[group_id]:
        del group_locations[group_id][sid]
        
        # ถ้า group ว่างเปล่า ลบ group
        if not group_locations[group_id]:
            del group_locations[group_id]
    
    # แจ้งคนอื่นใน group
    await sio.emit('user_left', {'sid': sid}, room=group_id)
    print(f'   User {sid} left group {group_id}')

@sio.event
async def join_group(sid, data):
    group_id = data.get('group_id', '').strip()
    
    if not group_id:
        return {"status": "error", "message": "Invalid group ID"}
    
    print(f'📥 {sid} joining group: {group_id}')
    
    # ถ้าอยู่ group เดิมอยู่แล้ว ให้ออกก่อน
    if sid in user_groups:
        old_group = user_groups[sid]
        if old_group != group_id:
            await handle_leave_group(sid, old_group)
    
    # เข้า room ใหม่
    await sio.enter_room(sid, group_id)
    user_groups[sid] = group_id
    
    # สร้าง group ใหม่ถ้ายังไม่มี
    if group_id not in group_locations:
        group_locations[group_id] = {}
    
    # ส่ง location ของคนอื่นๆ ใน group ให้คนที่เพิ่งเข้ามา
    existing_locations = list(group_locations[group_id].values())
    await sio.emit('group_locations', existing_locations, to=sid)
    
    # แจ้งคนอื่นใน group ว่ามีคนเข้ามาใหม่
    await sio.emit('user_joined', {
        'sid': sid,
        'group_id': group_id
    }, room=group_id, skip_sid=sid)
    
    print(f'   Group {group_id} now has {len(group_locations[group_id])} users')
    
    return {
        "status": "success",
        "group_id": group_id,
        "members_count": len(group_locations[group_id])
    }

@sio.event
async def leave_group(sid, data):
    if sid not in user_groups:
        return {"status": "error", "message": "Not in any group"}
    
    group_id = user_groups[sid]
    print(f'📤 {sid} leaving group: {group_id}')
    
    await handle_leave_group(sid, group_id)
    
    return {"status": "success"}

@sio.event
async def update_location(sid, data):
    # เช็คว่าอยู่ใน group ไหม
    if sid not in user_groups:
        return {"status": "error", "message": "Not in any group"}
    
    group_id = user_groups[sid]
    lat = data.get('lat')
    lng = data.get('lng')
    
    print(f"📍 Location from {sid} in group {group_id}:")
    print(f"   Lat: {lat}, Lng: {lng}")
    
    # เก็บข้อมูล location
    location_data = {
        'sid': sid,
        'lat': lat,
        'lng': lng,
        'timestamp': data.get('timestamp'),
        'updated_at': datetime.now().isoformat()
    }
    
    group_locations[group_id][sid] = location_data
    
    # ส่งไปหาคนอื่นใน group เดียวกันเท่านั้น
    members_count = len(group_locations[group_id])
    print(f"   Broadcasting to {members_count - 1} members in group {group_id}")
    
    await sio.emit('location_update', location_data, room=group_id, skip_sid=sid)
    
    return {
        "status": "received",
        "group_id": group_id,
        "members_count": members_count
    }

if __name__ == '__main__':
    print("="*60)
    print("🚀 Socket.IO Server with Group System")
    print("="*60)
    print("📍 Endpoints:")
    print("   - WebSocket: ws://0.0.0.0:8000")
    print("   - Status API: http://0.0.0.0:8000/api/status")
    print("="*60)
    print("📋 Events:")
    print("   - join_group: เข้า group")
    print("   - leave_group: ออกจาก group")
    print("   - update_location: ส่ง location (ต้องอยู่ใน group)")
    print("="*60)
    uvicorn.run(socket_app, host='0.0.0.0', port=8000, log_level="warning")
