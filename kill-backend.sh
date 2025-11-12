#!/bin/bash
# Script para matar procesos del backend en puerto 8000

echo "🔍 Buscando procesos en puerto 8000..."

PIDS=$(lsof -ti:8000 2>/dev/null)

if [ -z "$PIDS" ]; then
    echo "✅ No hay procesos usando el puerto 8000"
    exit 0
fi

echo "📋 Procesos encontrados:"
lsof -i:8000

echo ""
echo "🛑 Matando procesos..."
for PID in $PIDS; do
    echo "   Matando proceso $PID..."
    kill -9 $PID 2>/dev/null
done

sleep 1

# Verificar que se cerraron
REMAINING=$(lsof -ti:8000 2>/dev/null)
if [ -z "$REMAINING" ]; then
    echo "✅ Todos los procesos fueron terminados"
else
    echo "⚠️ Algunos procesos aún están corriendo:"
    lsof -i:8000
fi

