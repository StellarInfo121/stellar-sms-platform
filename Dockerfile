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

# Copy application code FIRST, then overlay the built frontend on top
COPY . .
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV PORT=8080
EXPOSE 8080
CMD ["gunicorn", "app:app", "-c", "gunicorn.conf.py"]
