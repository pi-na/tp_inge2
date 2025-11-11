
# main.py
# MVP backend for "La Segunda" — FastAPI + MongoDB (Motor)
# Run:
#   uvicorn main:app --reload
# Env:
#   MONGO_URI=mongodb://localhost:27017  (default)
#   MONGO_DB=la_segunda

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Optional, List, Literal

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends, Header, Query, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

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

# -------------
# FastAPI app
# -------------
app = FastAPI(title="La Segunda — MVP API", version="0.1.0")

ALLOWED_ORIGINS = [os.getenv("FRONT_ORIGIN", "http://localhost:5173")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,   # en dev: ["*"] si querés
    allow_credentials=True,
    allow_methods=["*"],             # GET, POST, PATCH, DELETE, OPTIONS
    allow_headers=["*"],             # incluye X-User-Id, Content-Type, etc.
)


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
    # Ready ping
    await db.command("ping")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

# ---------
# Utilities
# ---------
def now() -> datetime:
    return datetime.utcnow()

def geojson_point(p: GeoPoint) -> dict[str, Any]:
    return {"type": "Point", "coordinates": [p.lng, p.lat]}

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
# Users
# -------------
@app.post("/users/login", response_model=UserOut)
async def login_user(body: UserCreate):
    user = await db.users.find_one({"name": body.name})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
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
