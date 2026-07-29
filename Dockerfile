FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 libyaml-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data

EXPOSE 8080

ENV FLASK_ENV=production
ENV FLASK_DEBUG=False

CMD ["gunicorn", "-c", "gunicorn.conf.py", "-b", "0.0.0.0:8080", "app:app"]
