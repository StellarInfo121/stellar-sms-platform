FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
COPY . .
EXPOSE 8080
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8080"]
