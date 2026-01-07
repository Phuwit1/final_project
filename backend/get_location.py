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

# ==========================================
# 💾 ส่วนที่เพิ่ม/แก้ไขข้อมูล (Data Store)
# ==========================================

# เก็บข้อมูล: {socket_id: group_id}
user_groups: Dict[str, str] = {}

# [ใหม่] เก็บชื่อ: {socket_id: username}
user_names: Dict[str, str] = {}

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
        "groups": groups_info,
        # (Optional) ดูรายชื่อคนทั้งหมดเพื่อ debug
        "users_list": list(user_names.values()) 
    }

@sio.event
async def connect(sid, environ):
    client_ip = environ.get('REMOTE_ADDR', 'unknown')
    print(f'✅ Client connected: {sid} from {client_ip}')

@sio.event
async def disconnect(sid):
    print(f'❌ Client disconnected: {sid}')
    if sid in user_groups:
        group_id = user_groups[sid]
        await handle_leave_group(sid, group_id)

async def handle_leave_group(sid, group_id):
    """ฟังก์ชันช่วยสำหรับออกจาก group"""
    await sio.leave_room(sid, group_id)
    
    # ดึงชื่อมาก่อนลบ เพื่อเอาไปแจ้งเตือนคนอื่น
    username = user_names.get(sid, 'Unknown')

    # [แก้ไข] ลบข้อมูล group และ username
    if sid in user_groups:
        del user_groups[sid]
    
    if sid in user_names:
        del user_names[sid]
    
    if group_id in group_locations and sid in group_locations[group_id]:
        del group_locations[group_id][sid]
        if not group_locations[group_id]:
            del group_locations[group_id]
    
    # แจ้งคนอื่นใน group ว่าใครออก
    await sio.emit('user_left', {
        'sid': sid, 
        'username': username
    }, room=group_id)
    
    print(f'   User {username} ({sid}) left group {group_id}')

@sio.event
async def join_group(sid, data):
    group_id = data.get('group_id', '').strip()
    # [ใหม่] รับค่า username ถ้าไม่มีให้ใช้ sid ย่อๆ แทน
    username = data.get('username', f'User-{sid[:4]}').strip()
    
    if not group_id:
        return {"status": "error", "message": "Invalid group ID"}
    
    print(f'📥 {username} ({sid}) joining group: {group_id}')
    
    # ถ้าอยู่ group เดิมให้ออกก่อน
    if sid in user_groups:
        old_group = user_groups[sid]
        if old_group != group_id:
            await handle_leave_group(sid, old_group)
    
    await sio.enter_room(sid, group_id)
    
    # [แก้ไข] บันทึกทั้ง Group ID และ Username
    user_groups[sid] = group_id
    user_names[sid] = username
    
    if group_id not in group_locations:
        group_locations[group_id] = {}
    
    # ส่ง location ของคนอื่นให้คนใหม่ (คนใหม่จะเห็นชื่อคนเก่าเพราะข้อมูลมี username แล้ว)
    # existing_locations = list(group_locations[group_id].values())
    # await sio.emit('group_locations', existing_locations, to=sid)

    current_users = group_locations.get(group_id, {})
    for other_sid, location_data in current_users.items():
        if other_sid != sid:
            await sio.emit('location_update', location_data, to=sid)
            print(f"Sent stored location of {location_data.get('username')} to {sid}")
    
    # แจ้งคนอื่นว่ามีคนใหม่เข้ามา พร้อมชื่อ
    await sio.emit('user_joined', {
        'sid': sid,
        'username': username,
        'group_id': group_id
    }, room=group_id, skip_sid=sid)
    
    return {
        "status": "success",
        "group_id": group_id,
        "username": username,
        "members_count": len(group_locations[group_id]) + 1 # +1 ตัวเองที่เพิ่งเข้า (ถ้ายังไม่ส่ง loc จะยังไม่มีใน dict)
    }

@sio.event
async def leave_group(sid, data):
    if sid not in user_groups:
        return {"status": "error", "message": "Not in any group"}
    
    group_id = user_groups[sid]
    await handle_leave_group(sid, group_id)
    return {"status": "success"}

@sio.event
async def update_location(sid, data):
    if sid not in user_groups:
        return {"status": "error", "message": "Not in any group"}
    
    group_id = user_groups[sid]
    # [ใหม่] ดึงชื่อผู้ใช้มาด้วย
    username = user_names.get(sid, 'Unknown')

    lat = data.get('lat')
    lng = data.get('lng')
    
    # [แก้ไข] เพิ่ม username เข้าไปใน object ที่จะเก็บและส่ง
    location_data = {
        'sid': sid,
        'username': username,
        'lat': lat,
        'lng': lng,
        'timestamp': data.get('timestamp'),
        'updated_at': datetime.now().isoformat()
    }
    
    group_locations[group_id][sid] = location_data
    
    # Broadcast
    await sio.emit('location_update', location_data, room=group_id, skip_sid=sid)
    
    return {
        "status": "received",
        "username": username
    }

if __name__ == '__main__':
    print("="*60)
    print("🚀 Socket.IO Server with Group System")
    print("="*60)
    print("📍 Endpoints:")
    print("   - WebSocket: ws://0.0.0.0:8010")
    print("   - Status API: http://0.0.0.0:8010/api/status")
    print("="*60)
    print("📋 Events:")
    print("   - join_group: เข้า group")
    print("   - leave_group: ออกจาก group")
    print("   - update_location: ส่ง location (ต้องอยู่ใน group)")
    print("="*60)
    uvicorn.run(socket_app, host='0.0.0.0', port=8010, log_level="warning")