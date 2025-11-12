FROM node:18-alpine

WORKDIR /app

# Argumento de build para VITE_API_URL
ARG VITE_API_URL=http://127.0.0.1:8000
ENV VITE_API_URL=$VITE_API_URL

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código del frontend
COPY . .

# Exponer puerto
EXPOSE 5173

# Comando para desarrollo (con hot reload)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

