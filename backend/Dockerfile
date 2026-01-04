FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
ENV PIP_DEFAULT_TIMEOUT=120
RUN set -eux; \
    unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY; \
    sed -i 's|http://deb.debian.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    sed -i 's|http://security.debian.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    apt-get update && apt-get install -y libreoffice ffmpeg && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY app ./app
ENV PYTHONPATH=/app

CMD ["bash", "-lc", "python -m app.db.init_db && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
