# Configuración Docker

## Desarrollo

### Levantar todos los servicios

```bash
docker-compose up -d
```

Esto levanta:
- **MongoDB** en puerto `27017`
- **RabbitMQ** en puertos `5672` (AMQP) y `15672` (Management UI)
- **Backend FastAPI** en puerto `8000`
- **Frontend React** en puerto `5173`

### Ver logs

```bash
# Todos los servicios
docker-compose logs -f

# Servicio específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
docker-compose logs -f rabbitmq
```

### Detener servicios

```bash
docker-compose down
```

### Reconstruir imágenes

```bash
docker-compose build
docker-compose up -d
```

## Producción

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Acceso a servicios

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **RabbitMQ Management**: http://localhost:15672 (admin/admin)
- **MongoDB**: localhost:27017

## Variables de entorno

### Backend

Puedes crear un archivo `.env` o modificar `docker-compose.yml`:

```yaml
environment:
  - MONGO_URI=mongodb://mongodb:27017
  - MONGO_DB=la_segunda
  - RABBITMQ_URI=amqp://admin:admin@rabbitmq:5672/
```

### Frontend

Para cambiar la URL del backend, modifica `VITE_API_URL` en `docker-compose.yml`:

```yaml
environment:
  - VITE_API_URL=http://localhost:8000
```

O crea `la-segunda-fe/.env`:
```
VITE_API_URL=http://localhost:8000
```

## Hot Reload

En desarrollo, los volúmenes están configurados para hot reload:
- Backend: cambios en `main.py` se reflejan automáticamente
- Frontend: cambios en `src/` se reflejan automáticamente

## Troubleshooting

### Limpiar todo y empezar de nuevo

```bash
docker-compose down -v  # Elimina volúmenes también
docker-compose build --no-cache
docker-compose up -d
```

### Ver estado de servicios

```bash
docker-compose ps
```

### Entrar a un contenedor

```bash
docker-compose exec backend bash
docker-compose exec frontend sh
```

### Verificar conexiones

```bash
# MongoDB
docker-compose exec backend python3 -c "from motor.motor_asyncio import AsyncIOMotorClient; import asyncio; asyncio.run(AsyncIOMotorClient('mongodb://mongodb:27017').admin.command('ping'))"

# RabbitMQ
docker-compose exec rabbitmq rabbitmq-diagnostics ping
```

