# Solución rápida: Login desde celular con ngrok

## El problema
Cuando accedes desde el celular vía ngrok, el frontend intenta conectarse a `http://127.0.0.1:8000`, que no funciona desde el celular.

## Solución (3 pasos)

### 1. Inicia ngrok para el backend
En una terminal, ejecuta:
```bash
ngrok http 8000
```

Copia la URL HTTPS que muestra (ej: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`)

### 2. Configura el frontend
Ejecuta el script:
```bash
./config-ngrok-docker.sh
```

Pega la URL del backend cuando te lo pida.

### 3. Reinicia el frontend
```bash
docker-compose restart frontend
```

## Verificar
1. Abre la consola del navegador en tu celular
2. Deberías ver: `🔗 API URL configurada: https://xxxx-xx-xx-xx-xx.ngrok-free.app`
3. El login debería funcionar

## Nota
Cada vez que reinicies ngrok, la URL cambia. Tendrás que:
1. Copiar la nueva URL
2. Ejecutar `./config-ngrok-docker.sh` de nuevo
3. Reiniciar el frontend
