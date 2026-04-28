FROM node:20-slim
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./
COPY frontend/dist/ ./frontend/dist/
EXPOSE 3000
CMD ["npm", "start"]
