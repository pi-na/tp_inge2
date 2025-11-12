# La Segunda - MVP

Aplicación de eventos sociales con notificaciones en tiempo real usando RabbitMQ y SSE.

## Inicio Rápido

### Opción A: Docker (Recomendado)

```bash
# Levantar todos los servicios (MongoDB, RabbitMQ, Backend, Frontend)
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

Ver `DOCKER_SETUP.md` para más detalles.

### Opción B: Desarrollo Local

```bash
# 1. Instalar dependencias
pip3 install -r requirements.txt
cd la-segunda-fe && npm install && cd ..

# 2. Levantar servicios
# RabbitMQ (Docker)
docker-compose up -d rabbitmq mongodb

# Backend y Frontend
./start-dev.sh
```

### 3. Acceder

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- RabbitMQ Management: http://localhost:15672 (admin/admin)

## Comandos Útiles

### Matar proceso del backend

```bash
./kill-backend.sh
# O manualmente:
lsof -ti:8000 | xargs kill -9
```

### Ver logs de RabbitMQ

```bash
docker logs -f la_segunda_rabbitmq
```

### Configurar ngrok para celular

**Opción 1: Script automático (recomendado)**
```bash
./config-ngrok.sh
```

**Opción 2: Manual**
Ver `CONFIGURAR_NGROK_CELU.md`

## Estructura

- `main.py` - Backend FastAPI con RabbitMQ y SSE
- `la-segunda-fe/` - Frontend React
- `docker-compose.yml` - RabbitMQ
- `start-dev.sh` - Script para iniciar todo
- `kill-backend.sh` - Script para matar procesos

## Documentación

- `DEBUG_NOTIFICACIONES.md` - Guía de debugging de notificaciones
- `RABBITMQ_SETUP.md` - Configuración de RabbitMQ
- `CONFIGURAR_NGROK_CELU.md` - Configuración para celular
- `SOLUCION_NGROK.md` - Solución de problemas con ngrok
