FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
ENV PIP_DEFAULT_TIMEOUT=120
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY app ./app
ENV PYTHONPATH=/app

CMD ["bash", "-lc", "python -m app.db.init_db && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
