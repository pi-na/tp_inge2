
# main.py
# MVP backend for "La Segunda" — FastAPI + MongoDB (Motor)
# Run:
#   uvicorn main:app --reload
# Env:
#   MONGO_URI=mongodb://localhost:27017  (default)
#   MONGO_DB=la_segunda

from __future__ import annotations

import os
import json
import asyncio
from datetime import datetime
from typing import Any, Optional, List, Literal

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends, Header, Query, Body
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import aio_pika

# ----------------------------
# Simplificaciones (decisiones)
# ----------------------------
# - Autenticación "mínima": cada request incluye X-User-Id con el _id del usuario (string ObjectId).
#   No passwords. Para el MVP alcanza.
# - Geolocalización: GeoJSON {type:"Point", coordinates:[lon, lat]} con índice 2dsphere.
# - Estado de evento: "activo" se modela como entero: 0=eliminado, 1=activo, 2=cancelado.
# - Listas de participantes guardan ObjectId directamente.
# - Descubrimiento: si llega lat/lon, usamos $geoNear para ordenar por cercanía y (opcional) filtrar por distancia.
# - Contadores de usuario (visitados/organizados/no-shows) se actualizan con endpoints explícitos de "complete" y "no_show".

# -----------------
# Mongo connection
# -----------------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "la_segunda")

client: AsyncIOMotorClient | None = None
db = None

# -----------------
# RabbitMQ connection
# -----------------
RABBITMQ_URI = os.getenv("RABBITMQ_URI", "amqp://admin:admin@localhost:5672/")
rabbitmq_connection: aio_pika.Connection | None = None
rabbitmq_channel: aio_pika.Channel | None = None
notification_exchange: aio_pika.Exchange | None = None

# -----------------
# SSE streams (user_id -> asyncio.Queue)
# -----------------
active_sse_streams: dict[str, asyncio.Queue] = {}

# -------------
# Pydantic I/O
# -------------
class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)

class UserOut(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    description: Optional[str] = None
    cant_events_visited: int = 0
    cant_events_organized: int = 0
    cant_no_shows: int = 0
    rating: float = 0.0
    created_at: datetime
    updated_at: datetime

class GeoPoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)

class EventCreate(BaseModel):
    # Campos mínimos + "title" (útil para descubrir), opcional description
    title: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    fecha_inicio: datetime
    fecha_fin: datetime
    location: GeoPoint
    location_alias: Optional[str] = Field(None, max_length=80)
    category: str = Field(...)
    # status/activo no se recibe en create: siempre 1 (activo)

class EventOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    activo: int  # 0 eliminado, 1 activo, 2 cancelado
    finalizado: bool = False  # marcado como finalizado por el organizador
    organizer_id: str
    organizer_name: Optional[str] = None
    organizer_rating: Optional[float] = None
    confirmed_participants: List[str]
    pending_approval_participants: List[str]
    blacklisted_participants: List[str]
    location: GeoPoint
    location_alias: Optional[str] = None
    category: str
    created_at: datetime
    updated_at: datetime
    distance_meters: Optional[float] = None  # presente sólo si consulta con lat/lng

class AcceptRejectBody(BaseModel):
    user_id: str
    blacklist: bool = False

class MyEventsOut(BaseModel):
    activos_no_finalizados: List[EventOut]
    activos_finalizados: List[EventOut]
    eliminados: List[EventOut]

class NotificationOut(BaseModel):
    id: str
    user_id: str
    type: str  # "new_application", "application_accepted", "application_rejected", "event_started", "event_finished", "event_cancelled"
    title: str
    message: str
    event_id: Optional[str] = None
    event_title: Optional[str] = None
    read: bool = False
    created_at: datetime

# -------------
# FastAPI app
# -------------
app = FastAPI(title="La Segunda — MVP API", version="0.1.0")

# Configuración de CORS flexible para desarrollo
FRONT_ORIGIN = os.getenv("FRONT_ORIGIN", "")
if FRONT_ORIGIN:
    # Si hay variable de entorno, usarla
    ALLOWED_ORIGINS = [FRONT_ORIGIN]
elif os.getenv("ENV") == "production":
    # En producción, solo localhost
    ALLOWED_ORIGINS = ["http://localhost:5173"]
else:
    # En desarrollo, permitir todos los orígenes (útil para IP local y ngrok)
    ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],             # GET, POST, PATCH, DELETE, OPTIONS
    allow_headers=["*"],             # incluye X-User-Id, Content-Type, etc.
)

# Middleware para logging de requests (después de CORS)
@app.middleware("http")
async def log_requests(request, call_next):
    if request.url.path == "/users/login" and request.method == "POST":
        print(f"🔍 POST /users/login recibido")
        print(f"🔍 Headers: {dict(request.headers)}")
        print(f"🔍 Content-Type: {request.headers.get('content-type', 'N/A')}")
        print(f"🔍 Content-Length: {request.headers.get('content-length', 'N/A')}")
    response = await call_next(request)
    if request.url.path == "/users/login" and request.method == "POST":
        print(f"🔍 Response status: {response.status_code}")
    return response


CATEGORIES = [
    "deportes", "cultural", "gastronomia", "turismo", "networking"
]

def ensure_oid(s: str) -> ObjectId:
    if not s:
        raise HTTPException(status_code=400, detail="id inválido: string vacío")
    s = s.strip()
    if not ObjectId.is_valid(s):
        raise HTTPException(status_code=400, detail=f"id inválido: '{s}' (longitud: {len(s)})")
    return ObjectId(s)

async def get_current_user_id(x_user_id: Optional[str] = Header(default=None, alias="X-User-Id")) -> ObjectId:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id requerido para esta operación")
    # Limpiar espacios y validar
    x_user_id = x_user_id.strip() if isinstance(x_user_id, str) else str(x_user_id).strip()
    return ensure_oid(x_user_id)

def serialize_user(doc: dict[str, Any]) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        name=doc["name"],
        phone=doc.get("phone"),
        description=doc.get("description"),
        cant_events_visited=doc.get("cant_events_visited", 0),
        cant_events_organized=doc.get("cant_events_organized", 0),
        cant_no_shows=doc.get("cant_no_shows", 0),
        rating=float(doc.get("rating", 0.0)),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )

def serialize_event(doc: dict[str, Any], organizer_info: Optional[dict[str, Any]] = None) -> EventOut:
    loc = doc["location"]["coordinates"]  # [lng, lat]
    organizer_name = None
    organizer_rating = None
    if organizer_info:
        organizer_name = organizer_info.get("name")
        organizer_rating = float(organizer_info.get("rating", 0.0))
    out = EventOut(
        id=str(doc["_id"]),
        title=doc["title"],
        description=doc.get("description"),
        fecha_inicio=doc["fecha_inicio"],
        fecha_fin=doc["fecha_fin"],
        activo=int(doc["activo"]),
        finalizado=bool(doc.get("finalizado", False)),
        organizer_id=str(doc["organizer_id"]),
        organizer_name=organizer_name,
        organizer_rating=organizer_rating,
        confirmed_participants=[str(u) for u in doc.get("confirmed_participants", [])],
        pending_approval_participants=[str(u) for u in doc.get("pending_approval_participants", [])],
        blacklisted_participants=[str(u) for u in doc.get("blacklisted_participants", [])],
        location=GeoPoint(lat=loc[1], lng=loc[0]),
        location_alias=doc.get("location_alias"),
        category=doc["category"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        distance_meters=doc.get("distance_meters"),
    )
    return out

# ------------------------
# Lifespan / Indexes setup
# ------------------------
async def rabbitmq_consumer():
    """Consumer de RabbitMQ que envía notificaciones a SSE streams"""
    global rabbitmq_connection, rabbitmq_channel, notification_exchange
    
    # Esperar un poco para que MongoDB esté listo
    await asyncio.sleep(2)
    
    print(f"🔄 Intentando conectar a RabbitMQ: {RABBITMQ_URI}")
    
    try:
        # Conectar a RabbitMQ
        print("📡 Conectando a RabbitMQ...")
        rabbitmq_connection = await aio_pika.connect_robust(RABBITMQ_URI)
        print("✅ Conexión a RabbitMQ establecida")
        
        rabbitmq_channel = await rabbitmq_connection.channel()
        print("✅ Canal de RabbitMQ creado")
        
        # Crear exchange y queue
        notification_exchange = await rabbitmq_channel.declare_exchange(
            "notifications", aio_pika.ExchangeType.DIRECT, durable=True
        )
        print("✅ Exchange 'notifications' declarado")
        
        queue = await rabbitmq_channel.declare_queue("notification_queue", durable=True)
        print("✅ Queue 'notification_queue' declarada")
        
        await queue.bind(notification_exchange, routing_key="notifications")
        print("✅ Queue vinculada al exchange")
        
        print("=" * 60)
        print("✅ RabbitMQ conectado y consumer iniciado correctamente")
        print("=" * 60)
        
        # Consumir mensajes
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                try:
                    async with message.process():
                        data = json.loads(message.body.decode())
                        user_id = data["user_id"]
                        
                        # Enviar a SSE stream si está activo
                        if user_id in active_sse_streams:
                            print(f"📤 Enviando notificación a usuario {user_id} via SSE (tipo: {data.get('type', 'unknown')})")
                            await active_sse_streams[user_id].put(data)
                        else:
                            print(f"⚠️ Usuario {user_id} no tiene SSE stream activo.")
                            print(f"   Streams activos: {list(active_sse_streams.keys())}")
                            print(f"   Nota: La notificación se guardó en MongoDB y aparecerá cuando el usuario recargue la página.")
                except Exception as e:
                    print(f"❌ Error procesando mensaje de RabbitMQ: {e}")
                    import traceback
                    traceback.print_exc()
    except Exception as e:
        print("=" * 60)
        print(f"❌ Error en consumer de RabbitMQ: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        # Si RabbitMQ no está disponible, continuar sin él
        rabbitmq_connection = None
        rabbitmq_channel = None
        notification_exchange = None

async def check_event_starts():
    """Tarea en background que verifica eventos que comenzaron y notifica a participantes"""
    while True:
        try:
            await asyncio.sleep(60)  # Verificar cada minuto
            now_dt = now()
            
            # Buscar eventos que comenzaron en el último minuto
            cursor = db.events.find({
                "activo": 1,
                "finalizado": {"$ne": True},
                "fecha_inicio": {
                    "$gte": datetime.fromtimestamp(now_dt.timestamp() - 120),  # Últimos 2 minutos
                    "$lte": now_dt
                }
            })
            
            async for ev in cursor:
                # Notificar a participantes confirmados
                for participant_id in ev.get("confirmed_participants", []):
                    # Verificar si ya notificamos este evento
                    existing = await db.notifications.find_one({
                        "user_id": ObjectId(participant_id),
                        "event_id": ev["_id"],
                        "type": "event_started"
                    })
                    if not existing:
                        await publish_notification(
                            user_id=str(participant_id),
                            notification_type="event_started",
                            title="Evento comenzó",
                            message=f"El evento '{ev['title']}' ha comenzado",
                            event_id=str(ev["_id"]),
                            event_title=ev["title"],
                        )
        except Exception as e:
            print(f"Error en check_event_starts: {e}")

@app.on_event("startup")
async def on_startup():
    global client, db
    client = AsyncIOMotorClient(MONGO_URI)  # equivalente a hacer "use lasegunda"
    db = client[MONGO_DB]
    # Indexes
    await db.users.create_index("name")
    await db.events.create_index([("location", "2dsphere")])
    await db.events.create_index([("category", 1)])
    await db.events.create_index([("fecha_inicio", 1)])
    await db.events.create_index([("activo", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    # Ready ping
    await db.command("ping")
    
    # Iniciar consumer de RabbitMQ en background
    asyncio.create_task(rabbitmq_consumer())
    # Iniciar tarea para verificar eventos que comienzan
    asyncio.create_task(check_event_starts())

@app.on_event("shutdown")
async def on_shutdown():
    print("🛑 Cerrando conexiones...")
    # Cerrar todos los SSE streams
    for user_id in list(active_sse_streams.keys()):
        del active_sse_streams[user_id]
    print(f"✅ {len(active_sse_streams)} SSE streams cerrados")
    
    # Cerrar RabbitMQ
    if rabbitmq_connection:
        try:
            await rabbitmq_connection.close()
            print("✅ Conexión RabbitMQ cerrada")
        except Exception as e:
            print(f"⚠️ Error cerrando RabbitMQ: {e}")
    
    # Cerrar MongoDB
    if client:
        try:
            client.close()
            print("✅ Conexión MongoDB cerrada")
        except Exception as e:
            print(f"⚠️ Error cerrando MongoDB: {e}")
    
    print("✅ Shutdown completo")

# ---------
# Utilities
# ---------
def now() -> datetime:
    return datetime.utcnow()

def geojson_point(p: GeoPoint) -> dict[str, Any]:
    return {"type": "Point", "coordinates": [p.lng, p.lat]}

# ---------
# Notification utilities
# ---------
async def save_notification(user_id: str, notification_type: str, title: str, message: str, event_id: Optional[str] = None, event_title: Optional[str] = None):
    """Guarda una notificación en MongoDB"""
    doc = {
        "user_id": ObjectId(user_id),
        "type": notification_type,
        "title": title,
        "message": message,
        "event_id": ObjectId(event_id) if event_id else None,
        "event_title": event_title,
        "read": False,
        "created_at": now(),
    }
    await db.notifications.insert_one(doc)

async def publish_notification(user_id: str, notification_type: str, title: str, message: str, event_id: Optional[str] = None, event_title: Optional[str] = None):
    """Publica una notificación a RabbitMQ y la guarda en MongoDB"""
    # Guardar en MongoDB primero para obtener el ID
    doc = {
        "user_id": ObjectId(user_id),
        "type": notification_type,
        "title": title,
        "message": message,
        "event_id": ObjectId(event_id) if event_id else None,
        "event_title": event_title,
        "read": False,
        "created_at": now(),
    }
    result = await db.notifications.insert_one(doc)
    notification_id = str(result.inserted_id)
    
    # Publicar a RabbitMQ
    if not notification_exchange:
        print(f"⚠️ RabbitMQ no disponible, notificación guardada en MongoDB: {notification_id}")
        return
    
    notification_data = {
        "id": notification_id,
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "event_id": event_id,
        "event_title": event_title,
        "read": False,
        "created_at": doc["created_at"].isoformat(),
    }
    
    try:
        await notification_exchange.publish(
            aio_pika.Message(
                json.dumps(notification_data).encode(),
                content_type="application/json",
            ),
            routing_key="notifications",
        )
        print(f"✅ Notificación publicada a RabbitMQ para usuario {user_id}: {notification_type}")
    except Exception as e:
        print(f"❌ Error publicando notificación a RabbitMQ: {e}")
        print(f"   Exchange disponible: {notification_exchange is not None}")

def serialize_notification(doc: dict[str, Any]) -> NotificationOut:
    return NotificationOut(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        type=doc["type"],
        title=doc["title"],
        message=doc["message"],
        event_id=str(doc["event_id"]) if doc.get("event_id") else None,
        event_title=doc.get("event_title"),
        read=bool(doc.get("read", False)),
        created_at=doc["created_at"],
    )

# --------------
# Public routes
# --------------
@app.get("/health")
async def health():
    return {"ok": True, "time": now().isoformat()}

@app.get("/categories")
async def categories():
    return {"categories": CATEGORIES}

# -------------
# Notifications (SSE + History)
# -------------
@app.get("/notifications/stream")
async def stream_notifications(
    x_user_id: Optional[str] = Query(None, alias="X-User-Id"),
):
    """Endpoint SSE para recibir notificaciones en tiempo real"""
    # EventSource no puede enviar headers, así que aceptamos user_id como query param
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id requerido")
    user_id = ensure_oid(x_user_id)
    
    user_id_str = str(user_id)
    queue = asyncio.Queue()
    
    # Verificar si hay notificaciones no leídas recientes y enviarlas al conectar
    # (para notificaciones que llegaron antes de que el usuario se conectara)
    try:
        cursor = db.notifications.find(
            {
                "user_id": user_id,
                "read": False,
                "created_at": {"$gte": datetime.fromtimestamp(now().timestamp() - 300)}  # Últimos 5 minutos
            }
        ).sort("created_at", -1).limit(10)
        recent_notifications = [n async for n in cursor]
        
        # Enviar notificaciones recientes al stream
        for notif in reversed(recent_notifications):  # Más antiguas primero
            notification_data = {
                "id": str(notif["_id"]),
                "user_id": user_id_str,
                "type": notif["type"],
                "title": notif["title"],
                "message": notif["message"],
                "event_id": str(notif["event_id"]) if notif.get("event_id") else None,
                "event_title": notif.get("event_title"),
                "read": False,
                "created_at": notif["created_at"].isoformat(),
            }
            await queue.put(notification_data)
            print(f"📬 Reenviando notificación reciente al usuario {user_id_str}: {notif['type']}")
    except Exception as e:
        print(f"⚠️ Error al cargar notificaciones recientes: {e}")
    
    active_sse_streams[user_id_str] = queue
    print(f"🔔 SSE stream iniciado para usuario {user_id_str}. Total streams activos: {len(active_sse_streams)}")
    
    async def event_generator():
        try:
            while True:
                # Esperar mensaje de la queue (con timeout para mantener conexión viva)
                try:
                    notification = await asyncio.wait_for(queue.get(), timeout=30.0)
                    print(f"📤 Enviando notificación por SSE a usuario {user_id_str}: {notification.get('type', 'unknown')}")
                    yield f"data: {json.dumps(notification)}\n\n"
                except asyncio.TimeoutError:
                    # Enviar keepalive
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            if user_id_str in active_sse_streams:
                del active_sse_streams[user_id_str]
        except Exception as e:
            print(f"Error en SSE stream para usuario {user_id_str}: {e}")
            if user_id_str in active_sse_streams:
                del active_sse_streams[user_id_str]
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@app.get("/notifications", response_model=List[NotificationOut])
async def get_notifications(
    user_id: ObjectId = Depends(get_current_user_id),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
):
    """Obtiene el historial de notificaciones del usuario"""
    cursor = db.notifications.find(
        {"user_id": user_id}
    ).sort("created_at", -1).skip(skip).limit(limit)
    notifications = [serialize_notification(n) async for n in cursor]
    return notifications

@app.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user_id: ObjectId = Depends(get_current_user_id),
):
    """Marca una notificación como leída"""
    _id = ensure_oid(notification_id)
    notification = await db.notifications.find_one({"_id": _id, "user_id": user_id})
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    await db.notifications.update_one(
        {"_id": _id},
        {"$set": {"read": True}}
    )
    return {"ok": True}

@app.patch("/notifications/read-all")
async def mark_all_notifications_read(
    user_id: ObjectId = Depends(get_current_user_id),
):
    """Marca todas las notificaciones del usuario como leídas"""
    await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"ok": True}

# -------------
# Users
# -------------
@app.post("/users/login", response_model=UserOut)
async def login_user(body: UserCreate):
    print(f"🔍 login_user llamado con name: '{body.name}'")
    print(f"🔍 Buscando usuario en MongoDB...")
    user = await db.users.find_one({"name": body.name})
    print(f"🔍 Resultado de búsqueda: {user is not None}")
    if not user:
        print(f"🔍 Usuario '{body.name}' no encontrado en la base de datos")
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    print(f"🔍 Usuario encontrado: {user.get('name', 'N/A')}")
    return serialize_user(user)

@app.post("/users/register", response_model=UserOut)
async def register_user(body: UserCreate):
    # Verificar que el nombre no exista
    existing = await db.users.find_one({"name": body.name})
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese nombre")
    doc = {
        "name": body.name,
        "cant_events_visited": 0,
        "cant_events_organized": 0,
        "cant_no_shows": 0,
        "rating": 0.0,
        "created_at": now(),
        "updated_at": now(),
    }
    res = await db.users.insert_one(doc)
    user = await db.users.find_one({"_id": res.inserted_id})
    return serialize_user(user)

@app.get("/users/me", response_model=UserOut)
async def users_me(user_id: ObjectId = Depends(get_current_user_id)):
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(user)

@app.patch("/users/me", response_model=UserOut)
async def users_me_patch(
    payload: dict = Body(...),
    user_id: ObjectId = Depends(get_current_user_id),
):
    allowed = {"name", "rating", "phone", "description"}  # campos editables
    updates = {k: v for k, v in payload.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="Nada para actualizar")
    updates["updated_at"] = now()
    await db.users.update_one({"_id": user_id}, {"$set": updates})
    user = await db.users.find_one({"_id": user_id})
    return serialize_user(user)

@app.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: str):
    """Obtiene información de un usuario por su ID"""
    _id = ensure_oid(user_id)
    user = await db.users.find_one({"_id": _id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(user)

@app.post("/users/batch", response_model=List[UserOut])
async def get_users_batch(user_ids: List[str] = Body(...)):
    """Obtiene información de múltiples usuarios por sus IDs"""
    oids = [ensure_oid(uid) for uid in user_ids]
    cursor = db.users.find({"_id": {"$in": oids}})
    users = [serialize_user(u) async for u in cursor]
    return users

# -------------
# Events (CRUD)
# -------------
@app.post("/events", response_model=EventOut)
async def create_event(body: EventCreate, user_id: ObjectId = Depends(get_current_user_id)):
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoría inválida")
    doc = {
        "title": body.title,
        "description": body.description,
        "fecha_inicio": body.fecha_inicio,
        "fecha_fin": body.fecha_fin,
        "activo": 1,  # activo
        "finalizado": False,  # no finalizado al crear
        "organizer_id": user_id,
        "confirmed_participants": [],
        "pending_approval_participants": [],
        "blacklisted_participants": [],
        "location": geojson_point(body.location),
        "location_alias": body.location_alias,
        "category": body.category,
        "created_at": now(),
        "updated_at": now(),
    }
    res = await db.events.insert_one(doc)
    ev = await db.events.find_one({"_id": res.inserted_id})
    organizer = await db.users.find_one({"_id": user_id})
    return serialize_event(ev, organizer)

@app.get("/events/my", response_model=MyEventsOut)
async def get_my_events(user_id: ObjectId = Depends(get_current_user_id)):
    """Obtiene los eventos del usuario organizados por estado:
    - activos_no_finalizados: activos (activo=1) y no comenzados/en transcurso (fecha_fin >= ahora)
    - activos_finalizados: activos (activo=1) y finalizados (fecha_fin < ahora)
    - eliminados: eliminados (activo=0)
    """
    now_dt = now()
    
    # Eventos activos no finalizados (activo=1, no marcados como finalizados, y fecha_fin >= ahora)
    cursor_activos_no_fin = db.events.find({
        "organizer_id": user_id,
        "activo": 1,
        "finalizado": {"$ne": True},  # no finalizados
        "fecha_fin": {"$gte": now_dt}
    }).sort("fecha_inicio", 1)
    activos_no_finalizados = [d async for d in cursor_activos_no_fin]
    
    # Eventos activos finalizados (activo=1 y (marcados como finalizados O fecha_fin < ahora))
    cursor_activos_fin = db.events.find({
        "organizer_id": user_id,
        "activo": 1,
        "$or": [
            {"finalizado": True},  # marcados como finalizados
            {"fecha_fin": {"$lt": now_dt}}  # o fecha ya pasó
        ]
    }).sort("fecha_fin", -1)  # más recientes primero
    activos_finalizados = [d async for d in cursor_activos_fin]
    
    # Eventos eliminados (activo=0)
    cursor_eliminados = db.events.find({
        "organizer_id": user_id,
        "activo": 0
    }).sort("updated_at", -1)  # más recientes primero
    eliminados = [d async for d in cursor_eliminados]
    
    # Obtener información del organizador (el usuario mismo)
    organizer = await db.users.find_one({"_id": user_id})
    
    return {
        "activos_no_finalizados": [serialize_event(d, organizer) for d in activos_no_finalizados],
        "activos_finalizados": [serialize_event(d, organizer) for d in activos_finalizados],
        "eliminados": [serialize_event(d, organizer) for d in eliminados]
    }

@app.get("/events", response_model=List[EventOut])
async def list_events(
    status: int = Query(1, ge=0, le=2, alias="activo"),
    category: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    max_km: Optional[float] = Query(None, gt=0),
    q: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
):
    match: dict[str, Any] = {"activo": status}
    # Excluir eventos finalizados en la búsqueda de descubrir
    match["finalizado"] = {"$ne": True}  # no finalizados
    if category:
        match["category"] = category
    # fechas
    if from_date or to_date:
        match["fecha_inicio"] = {}
        if from_date:
            match["fecha_inicio"]["$gte"] = from_date
        if to_date:
            match["fecha_inicio"]["$lte"] = to_date
        if not match["fecha_inicio"]:
            match.pop("fecha_inicio")

    # Búsqueda por cercanía (y distancia en respuesta) si llega lat/lng
    pipeline: list[dict[str, Any]] = []
    if lat is not None and lng is not None:
        near_stage: dict[str, Any] = {
            "$geoNear": {
                "near": {"type": "Point", "coordinates": [lng, lat]},
                "distanceField": "distance_meters",
                "spherical": True,
                "query": match
            }
        }
        if max_km:
            near_stage["$geoNear"]["maxDistance"] = max_km * 1000.0
        pipeline.append(near_stage)
        if q:
            pipeline.append({"$match": {"title": {"$regex": q, "$options": "i"}}})
        pipeline += [
            {"$skip": skip},
            {"$limit": limit},
        ]
        cursor = db.events.aggregate(pipeline)
        docs = [d async for d in cursor]
        # Obtener organizadores únicos
        organizer_ids = list(set([d["organizer_id"] for d in docs]))
        organizers_map = {}
        if organizer_ids:
            org_cursor = db.users.find({"_id": {"$in": organizer_ids}})
            async for org in org_cursor:
                organizers_map[str(org["_id"])] = org
        # map distance_meters through serialization
        out = []
        for d in docs:
            # pass through computed distance
            d["distance_meters"] = float(d.get("distance_meters", 0.0))
            organizer = organizers_map.get(str(d["organizer_id"]))
            out.append(serialize_event(d, organizer))
        return out

    # Si no hay lat/lng: .find simple con filtros y sort por fecha
    query = match
    if q:
        query = {**match, "title": {"$regex": q, "$options": "i"}}
    cursor = db.events.find(query).sort("fecha_inicio", 1).skip(skip).limit(limit)
    docs = [d async for d in cursor]
    # Obtener organizadores únicos
    organizer_ids = list(set([d["organizer_id"] for d in docs]))
    organizers_map = {}
    if organizer_ids:
        org_cursor = db.users.find({"_id": {"$in": organizer_ids}})
        async for org in org_cursor:
            organizers_map[str(org["_id"])] = org
    return [serialize_event(d, organizers_map.get(str(d["organizer_id"]))) for d in docs]

@app.get("/events/{event_id}", response_model=EventOut)
async def get_event(event_id: str):
    _id = ensure_oid(event_id)
    ev = await db.events.find_one({"_id": _id})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    organizer = await db.users.find_one({"_id": ev["organizer_id"]})
    return serialize_event(ev, organizer)

@app.patch("/events/{event_id}/cancel", response_model=EventOut)
async def cancel_event(event_id: str, user_id: ObjectId = Depends(get_current_user_id)):
    _id = ensure_oid(event_id)
    ev = await db.events.find_one({"_id": _id})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if ev["organizer_id"] != user_id:
        raise HTTPException(status_code=403, detail="Sólo el organizador puede cancelar")
    await db.events.update_one({"_id": _id}, {"$set": {"activo": 2, "updated_at": now()}})
    ev = await db.events.find_one({"_id": _id})
    organizer = await db.users.find_one({"_id": ev["organizer_id"]})
    
    # Notificar a participantes confirmados y pendientes
    all_participants = list(ev.get("confirmed_participants", [])) + list(ev.get("pending_approval_participants", []))
    for participant_id in all_participants:
        await publish_notification(
            user_id=str(participant_id),
            notification_type="event_cancelled",
            title="Evento cancelado",
            message=f"El evento '{ev['title']}' ha sido cancelado",
            event_id=str(_id),
            event_title=ev["title"],
        )
    
    return serialize_event(ev, organizer)

@app.delete("/events/{event_id}", response_model=EventOut)
async def delete_event(event_id: str, user_id: ObjectId = Depends(get_current_user_id)):
    _id = ensure_oid(event_id)
    ev = await db.events.find_one({"_id": _id})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if ev["organizer_id"] != user_id:
        raise HTTPException(status_code=403, detail="Sólo el organizador puede eliminar")
    await db.events.update_one({"_id": _id}, {"$set": {"activo": 0, "updated_at": now()}})
    ev = await db.events.find_one({"_id": _id})
    organizer = await db.users.find_one({"_id": ev["organizer_id"]})
    return serialize_event(ev, organizer)

# -------------
# Postulación y moderación
# -------------
@app.post("/events/{event_id}/apply", response_model=EventOut)
async def apply_to_event(event_id: str, user_id: ObjectId = Depends(get_current_user_id)):
    _id = ensure_oid(event_id)
    ev = await db.events.find_one({"_id": _id})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if ev["activo"] != 1:
        raise HTTPException(status_code=400, detail="Evento no activo")
    if user_id == ev["organizer_id"]:
        raise HTTPException(status_code=400, detail="El organizador no necesita postularse")
    if user_id in ev.get("blacklisted_participants", []):
        raise HTTPException(status_code=403, detail="Usuario bloqueado para este evento")

    # quitar de confirmados por si acaso y agregar a pending (idempotente)
    await db.events.update_one(
        {"_id": _id},
        {
            "$pull": {"confirmed_participants": user_id},
            "$addToSet": {"pending_approval_participants": user_id},
            "$set": {"updated_at": now()},
        },
    )
    ev = await db.events.find_one({"_id": _id})
    organizer = await db.users.find_one({"_id": ev["organizer_id"]})
    
    # Notificar al organizador
    applicant = await db.users.find_one({"_id": user_id})
    applicant_name = applicant.get("name", "Un usuario") if applicant else "Un usuario"
    await publish_notification(
        user_id=str(ev["organizer_id"]),
        notification_type="new_application",
        title="Nueva postulación",
        message=f"{applicant_name} quiere unirse a tu evento '{ev['title']}'",
        event_id=str(_id),
        event_title=ev["title"],
    )
    
    return serialize_event(ev, organizer)

@app.post("/events/{event_id}/accept", response_model=EventOut)
async def accept_user(event_id: str, body: AcceptRejectBody, user_id: ObjectId = Depends(get_current_user_id)):
    _id = ensure_oid(event_id)
    target = ensure_oid(body.user_id)
    ev = await db.events.find_one({"_id": _id})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if ev["organizer_id"] != user_id:
        raise HTTPException(status_code=403, detail="Sólo el organizador puede aceptar")
    # mover de pending -> confirmed
    await db.events.update_one(
        {"_id": _id},
        {
            "$pull": {"pending_approval_participants": target},
            "$addToSet": {"confirmed_participants": target},
            "$set": {"updated_at": now()},
        },
    )
    ev = await db.events.find_one({"_id": _id})
    organizer = await db.users.find_one({"_id": ev["organizer_id"]})
    
    # Notificar al usuario aceptado
    await publish_notification(
        user_id=str(target),
        notification_type="application_accepted",
        title="Postulación aceptada",
        message=f"Tu solicitud para unirte a '{ev['title']}' fue aceptada",
        event_id=str(_id),
        event_title=ev["title"],
    )
    
    return serialize_event(ev, organizer)

@app.post("/events/{event_id}/reject", response_model=EventOut)
async def reject_user(event_id: str, body: AcceptRejectBody, user_id: ObjectId = Depends(get_current_user_id)):
    _id = ensure_oid(event_id)
    target = ensure_oid(body.user_id)
    ev = await db.events.find_one({"_id": _id})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if ev["organizer_id"] != user_id:
        raise HTTPException(status_code=403, detail="Sólo el organizador puede rechazar")
    update = {
        "$pull": {
            "pending_approval_participants": target,
            "confirmed_participants": target,
        },
        "$set": {"updated_at": now()},
    }
    if body.blacklist:
        update["$addToSet"] = {"blacklisted_participants": target}
    await db.events.update_one({"_id": _id}, update)
    ev = await db.events.find_one({"_id": _id})
    organizer = await db.users.find_one({"_id": ev["organizer_id"]})
    
    # Notificar al usuario rechazado
    message = f"Tu solicitud para unirte a '{ev['title']}' fue rechazada"
    if body.blacklist:
        message += " y fuiste bloqueado para este evento"
    await publish_notification(
        user_id=str(target),
        notification_type="application_rejected",
        title="Postulación rechazada",
        message=message,
        event_id=str(_id),
        event_title=ev["title"],
    )
    
    return serialize_event(ev, organizer)

# -------------
# Finalización + métricas simples
# -------------
@app.post("/events/{event_id}/complete", response_model=EventOut)
async def complete_event(event_id: str, user_id: ObjectId = Depends(get_current_user_id)):
    _id = ensure_oid(event_id)
    ev = await db.events.find_one({"_id": _id})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if ev["organizer_id"] != user_id:
        raise HTTPException(status_code=403, detail="Sólo el organizador puede completar")
    if ev.get("finalizado", False):
        raise HTTPException(status_code=400, detail="El evento ya está finalizado")
    # actualizar contadores
    confirmed: list[ObjectId] = ev.get("confirmed_participants", [])
    if confirmed:
        await db.users.update_many(
            {"_id": {"$in": confirmed}},
            {"$inc": {"cant_events_visited": 1}}
        )
    await db.users.update_one(
        {"_id": ev["organizer_id"]},
        {"$inc": {"cant_events_organized": 1}}
    )
    # Marcar evento como finalizado
    await db.events.update_one(
        {"_id": _id}, 
        {"$set": {"finalizado": True, "updated_at": now()}}
    )
    ev = await db.events.find_one({"_id": _id})
    organizer = await db.users.find_one({"_id": ev["organizer_id"]})
    
    # Notificar a participantes confirmados
    for participant_id in confirmed:
        await publish_notification(
            user_id=str(participant_id),
            notification_type="event_finished",
            title="Evento finalizado",
            message=f"El evento '{ev['title']}' ha finalizado",
            event_id=str(_id),
            event_title=ev["title"],
        )
    
    return serialize_event(ev, organizer)

@app.post("/events/{event_id}/no_show", response_model=EventOut)
async def mark_no_show(
    event_id: str,
    body: AcceptRejectBody,
    user_id: ObjectId = Depends(get_current_user_id)
):
    _id = ensure_oid(event_id)
    target = ensure_oid(body.user_id)
    ev = await db.events.find_one({"_id": _id})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if ev["organizer_id"] != user_id:
        raise HTTPException(status_code=403, detail="Sólo el organizador puede marcar no-show")
    # incrementar métrica y opcionalmente bloquear
    ops = [{"updateOne": {
        "filter": {"_id": target},
        "update": {"$inc": {"cant_no_shows": 1}}
    }}]
    if body.blacklist:
        ops.append({"updateOne": {
            "filter": {"_id": _id},
            "update": {"$addToSet": {"blacklisted_participants": target}}
        }})
    # Ejecutar operaciones
    await db.users.bulk_write(ops[:1])  # user inc
    if len(ops) > 1:
        await db.events.update_one({"_id": _id}, {"$addToSet": {"blacklisted_participants": target}})

    await db.events.update_one({"_id": _id}, {"$set": {"updated_at": now()}})
    ev = await db.events.find_one({"_id": _id})
    organizer = await db.users.find_one({"_id": ev["organizer_id"]})
    return serialize_event(ev, organizer)
