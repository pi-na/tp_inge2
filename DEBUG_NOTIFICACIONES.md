# Guía de Debugging de Notificaciones

## Checklist de Verificación

### 1. Verificar que RabbitMQ esté corriendo

```bash
docker ps | grep rabbitmq
```

Si no está corriendo:
```bash
docker-compose up -d
```

Verificar en la UI de RabbitMQ: http://localhost:15672
- Usuario: `admin`
- Contraseña: `admin`

### 2. Verificar que el backend esté conectado a RabbitMQ

Al iniciar el backend, deberías ver en la consola:
```
✅ RabbitMQ conectado y consumer iniciado
```

Si ves un error, verifica:
- Que RabbitMQ esté corriendo
- Que la URI sea correcta: `amqp://admin:admin@localhost:5672/`

### 3. Verificar que el SSE esté conectado

En la consola del navegador (F12), deberías ver:
```
🔔 Conectando a SSE: http://localhost:8000/notifications/stream?X-User-Id=...
✅ SSE conectado exitosamente
💓 SSE keepalive recibido
```

Si no ves estos mensajes:
- Verifica que estés logueado (hay un userId)
- Verifica la URL del backend
- Revisa la consola del navegador para errores

### 4. Probar que las notificaciones se publiquen

**Test 1: Postulación a evento**
1. Usuario A se postula a evento de Usuario B
2. En la consola del backend deberías ver:
   ```
   ✅ Notificación publicada a RabbitMQ para usuario [ID_B]: new_application
   📤 Enviando notificación a usuario [ID_B] via SSE
   📤 Enviando notificación por SSE a usuario [ID_B]: new_application
   ```
3. En la consola del navegador de Usuario B deberías ver:
   ```
   📨 Mensaje SSE recibido: data: {...}
   ✅ Notificación parseada: {...}
   ```

**Test 2: Aceptar postulación**
1. Usuario B acepta la postulación de Usuario A
2. Deberías ver los mismos logs pero para Usuario A

### 5. Verificar que las notificaciones se guarden en MongoDB

Conecta a MongoDB y verifica:
```javascript
use la_segunda
db.notifications.find().sort({created_at: -1}).limit(5)
```

Deberías ver las notificaciones recientes.

### 6. Debugging paso a paso

#### Problema: No llegan notificaciones en tiempo real

1. **Verifica RabbitMQ:**
   ```bash
   # Ver logs de RabbitMQ
   docker logs la_segunda_rabbitmq
   
   # Ver cola de notificaciones en la UI
   # http://localhost:15672 -> Queues -> notification_queue
   ```

2. **Verifica el consumer:**
   - En la consola del backend, busca errores relacionados con RabbitMQ
   - Verifica que veas: `✅ RabbitMQ conectado y consumer iniciado`

3. **Verifica SSE:**
   - Abre la consola del navegador (F12)
   - Busca mensajes que empiecen con 🔔, ✅, 📨
   - Si ves errores, copia el mensaje completo

4. **Verifica que el usuario tenga stream activo:**
   - En la consola del backend, cuando se publica una notificación, deberías ver:
     - `📤 Enviando notificación a usuario [ID] via SSE` (si hay stream)
     - `⚠️ Usuario [ID] no tiene SSE stream activo` (si no hay stream)

#### Problema: Las notificaciones se guardan pero no llegan en tiempo real

Esto significa que:
- ✅ RabbitMQ está funcionando (las notificaciones se publican)
- ✅ MongoDB está funcionando (se guardan)
- ❌ SSE no está funcionando o el usuario no tiene stream activo

**Solución:**
1. Verifica que el usuario esté logueado
2. Recarga la página para reconectar el SSE
3. Verifica en la consola del navegador que el SSE esté conectado
4. Verifica en la consola del backend que el usuario tenga un stream activo

#### Problema: No se guardan notificaciones en MongoDB

Esto significa que `publish_notification` no se está llamando o está fallando.

**Solución:**
1. Verifica que los endpoints estén llamando a `publish_notification`
2. Revisa los logs del backend para errores
3. Verifica que MongoDB esté corriendo

### 7. Comandos útiles para debugging

```bash
# Ver logs del backend en tiempo real
tail -f /tmp/backend.log  # Si usas start-dev.sh
# O simplemente mira la consola donde corriste uvicorn

# Ver logs de RabbitMQ
docker logs -f la_segunda_rabbitmq

# Verificar conexiones SSE activas
# En la consola del backend, cuando publiques una notificación,
# verás qué usuarios tienen streams activos

# Probar publicación manual (desde Python)
python3 -c "
import asyncio
import aio_pika
import json

async def test():
    conn = await aio_pika.connect_robust('amqp://admin:admin@localhost:5672/')
    channel = await conn.channel()
    exchange = await channel.declare_exchange('notifications', aio_pika.ExchangeType.DIRECT)
    await exchange.publish(
        aio_pika.Message(json.dumps({'user_id': 'TU_USER_ID', 'type': 'test', 'title': 'Test', 'message': 'Test'}).encode()),
        routing_key='notifications'
    )
    await conn.close()

asyncio.run(test())
"
```

### 8. Verificar en el navegador

1. Abre DevTools (F12)
2. Ve a la pestaña "Network"
3. Filtra por "EventSource" o busca "notifications/stream"
4. Deberías ver una conexión activa con estado 200
5. Haz clic en ella y ve a la pestaña "EventStream" para ver los mensajes en tiempo real

### 9. Problemas comunes

**Error: "ERR_NGROK_3200"**
- Solución: Agregar header `ngrok-skip-browser-warning: true` (ya está implementado)

**Error: "Connection refused" en SSE**
- Verifica que el backend esté corriendo
- Verifica que la URL sea correcta

**Las notificaciones aparecen pero sin animación**
- Verifica que `NotificationToaster` esté en `App.jsx`
- Verifica la consola del navegador para errores de React

**El contador no se actualiza**
- Verifica que `useNotifications` esté siendo usado en `NotificationBell`
- Verifica que el estado se esté actualizando correctamente

