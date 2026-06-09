# --- ETAPA DE CONSTRUCCIÓN ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias
RUN npm ci

# Generar el cliente de Prisma
RUN npx prisma generate

# Copiar el código fuente
COPY . .

# Compilar NestJS
RUN npm run build

# --- ETAPA DE PRODUCCIÓN ---
FROM node:20-alpine

WORKDIR /usr/src/app

# Variables de entorno por defecto
ENV NODE_ENV=production

# Copiar package.json y dependencias generadas
COPY package*.json ./
COPY prisma ./prisma/

# Instalar solo dependencias de producción
RUN npm ci --omit=dev

# Copiar el cliente de Prisma generado de la etapa de construcción
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# Copiar la carpeta compilada
COPY --from=builder /usr/src/app/dist ./dist

# Exponer el puerto
EXPOSE 4000

# Comando para ejecutar migraciones y arrancar el servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
