# La Segunda — MVP

Aplicación web para organizar y descubrir eventos locales.

## 🚀 Inicio Rápido

### 1. Levantar los servicios con Docker Compose

```bash
docker-compose up -d
```

Esto iniciará:
- **MongoDB** (puerto 27017)
- **RabbitMQ** (puerto 5672)
- **Backend FastAPI** (puerto 8000)
- **Frontend React** (puerto 5173)

### 2. Acceder al sitio

Abre tu navegador en:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 3. Detener los servicios

```bash
docker-compose down
```

Para detener y eliminar los contenedores (pero mantener los datos):
```bash
docker-compose stop
```

## 📱 Acceder desde el celular (ngrok)

Si quieres probar desde tu celular:

1. **Inicia ngrok para el backend**:
   ```bash
   ngrok http 8000
   ```
   Copia la URL HTTPS que muestra.

2. **Configura el frontend**:
   ```bash
   ./config-ngrok-docker.sh
   ```
   Pega la URL del backend cuando te lo pida.

3. **Inicia ngrok para el frontend** (en otra terminal):
   ```bash
   ngrok http 5173
   ```

4. **Abre la URL de ngrok del frontend en tu celular**

## 📚 Comandos útiles

Ver logs de todos los servicios:
```bash
docker-compose logs -f
```

Ver logs de un servicio específico:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

Reiniciar un servicio:
```bash
docker-compose restart backend
docker-compose restart frontend
```

Reconstruir después de cambios:
```bash
docker-compose build
docker-compose up -d
```

## 🔧 Desarrollo

El código del frontend está montado como volumen, por lo que los cambios se reflejan automáticamente (hot reload).

Para hacer cambios en el backend, edita `main.py` y el servidor se recargará automáticamente.

## 📖 Documentación adicional

- `NGROK_FRONTEND_DOCKER.md` - Configuración detallada de ngrok
- `DEBUG_NOTIFICACIONES.md` - Debugging de notificaciones
- `RABBITMQ_SETUP.md` - Información sobre RabbitMQ
