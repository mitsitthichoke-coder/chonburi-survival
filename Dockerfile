# เซิร์ฟเวอร์เกมออนไลน์ "ชลบุรี: วันล่มสลาย"
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080 DATA_DIR=/var/data
EXPOSE 8080
CMD ["node", "server.js"]
