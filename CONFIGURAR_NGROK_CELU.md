# Configuración para usar desde el celular con ngrok

## Problema
Cuando accedes desde el celular al frontend en ngrok (HTTPS), el navegador bloquea las requests al backend en HTTP (Mixed Content).

## Solución: Usar ngrok para el backend también

### Paso 1: Iniciar ngrok para el backend

En una terminal, ejecuta:
```bash
ngrok http 8000
```

Ngrok te mostrará algo como:
```
Forwarding  https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:8000
```

**Copia la URL HTTPS** (la que empieza con `https://`)

### Paso 2: Configurar el frontend

Edita el archivo `la-segunda-fe/.env` y agrega:

```bash
VITE_API_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

**Reemplaza `xxxx-xx-xx-xx-xx` con la URL que te dio ngrok del backend.**

### Paso 3: Reiniciar el frontend

```bash
cd la-segunda-fe
npm run dev
```

### Paso 4: Iniciar ngrok para el frontend (opcional)

Si quieres acceder al frontend también desde ngrok:

En otra terminal:
```bash
ngrok http 5173
```

Y usa esa URL en tu celular.

### Paso 5: Verificar

1. Abre la consola del navegador (en el celular, usa Chrome DevTools remoto o Safari Web Inspector)
2. Deberías ver:
   ```
   🔗 API URL configurada: https://xxxx-xx-xx-xx-xx.ngrok-free.app
   ```
3. Las requests deberían funcionar correctamente

## Nota importante

⚠️ **Cada vez que reinicies ngrok, la URL cambia.** Tendrás que:
1. Copiar la nueva URL
2. Actualizar `la-segunda-fe/.env`
3. Reiniciar el frontend (`npm run dev`)

## Alternativa: Usar solo IP local (sin ngrok)

Si estás en la misma red WiFi que tu celular:

1. **No uses ngrok para el frontend**
2. Accede directamente: `http://TU_IP:5173` (ej: `http://192.168.1.96:5173`)
3. El código detectará automáticamente la IP local y usará `http://TU_IP:8000` para el backend

**Ventaja**: No necesitas configurar nada
**Desventaja**: Solo funciona en la misma red WiFi

