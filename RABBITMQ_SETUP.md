# Configuración de RabbitMQ

## Levantar RabbitMQ con Docker

```bash
docker-compose up -d
```

Esto levanta RabbitMQ en:
- **Puerto AMQP**: `5672`
- **Management UI**: `http://localhost:15672`
  - Usuario: `admin`
  - Contraseña: `admin`

## Verificar que está corriendo

```bash
docker ps | grep rabbitmq
```

O accede a la UI de administración: http://localhost:15672

## Detener RabbitMQ

```bash
docker-compose down
```

## Variables de entorno (opcional)

Si quieres cambiar la configuración de RabbitMQ, puedes setear:

```bash
export RABBITMQ_URI="amqp://admin:admin@localhost:5672/"
```

Por defecto usa: `amqp://admin:admin@localhost:5672/`

## Notas

- El backend se conecta automáticamente a RabbitMQ al iniciar
- Si RabbitMQ no está disponible, el backend continuará funcionando pero sin notificaciones en tiempo real
- Las notificaciones se guardan en MongoDB incluso si RabbitMQ no está disponible

