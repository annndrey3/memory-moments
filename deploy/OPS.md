# Memory Moments — Ops / стабилизация (Итерация 3)

Готовые сниппеты для оставшихся (не-кодовых) пунктов плана стабилизации.
Выполняются на VPS (memory-moments.online). Процесс PM2: **`mm-api`**.

---

## 1. Ротация логов PM2 (`pm2-logrotate`)

Логи приложения (`console` + структурный JSON-лог запросов) растут безгранично —
включаем ротацию один раз:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M          # ротировать при 50 МБ
pm2 set pm2-logrotate:retain 14             # хранить 14 файлов
pm2 set pm2-logrotate:compress true         # gzip старых
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'   # + ежедневно в полночь
```

Проверка: `pm2 conf pm2-logrotate`, логи — `pm2 logs mm-api`.

---

## 2. Мониторинг доступности (`/api/health`)

`GET /api/health` теперь **глубокий**: пингует БД и возвращает **503**, если она
недоступна (а не «200 ok» при мёртвой базе). Это пригодно для внешнего монитора.

**Вариант А — внешний сервис (рекомендуется).** UptimeRobot / Better Uptime /
healthchecks.io:
- URL: `https://memory-moments.online/api/health`
- Интервал: 1–2 мин, ожидаемый код: `200`, алерт при `5xx`/таймауте → Telegram/email.

**Вариант Б — self-hosted cron-алерт в Telegram** (использует того же бота из `.env`):

```bash
# /var/www/memory-moments/deploy/healthcheck.sh
#!/usr/bin/env bash
set -a; . /var/www/memory-moments/t-shirt-designer-webapp-main/marketplace/server/.env; set +a
code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' https://memory-moments.online/api/health || echo 000)
if [ "$code" != "200" ]; then
  curl -s "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TG_CHAT_ID}" \
    -d text="🔴 mm-api health=${code} ($(date '+%F %T'))" >/dev/null
fi
```
```bash
chmod +x deploy/healthcheck.sh
crontab -e
# каждые 2 минуты:
*/2 * * * * /var/www/memory-moments/deploy/healthcheck.sh
```

---

## 3. Бэкапы: БД (`pg_dump`) + файлы (`uploads/`)

`uploads/` (print-макеты) — производственные артефакты, которых **нет в БД**, поэтому
бэкапим и базу, и файлы. Скрипт: [`deploy/backup.sh`](./backup.sh).

```bash
chmod +x deploy/backup.sh
bash deploy/backup.sh            # разовый прогон, проверить вывод и папку backups/

crontab -e
# ежедневно в 03:30:
30 3 * * * /var/www/memory-moments/deploy/backup.sh >> /var/log/mm-backup.log 2>&1
```

Скрипт сам берёт `DATABASE_URL`/`UPLOAD_DIR` из `marketplace/server/.env`, кладёт
`db-*.sql.gz` + `uploads-*.tar.gz` в `backups/` и удаляет копии старше 14 дней
(`MM_BACKUP_RETENTION_DAYS`). **Проверьте восстановление** хотя бы раз:

```bash
gunzip -c backups/db-YYYYmmdd-HHMMSS.sql.gz | psql "$DATABASE_URL"      # БД
tar -xzf backups/uploads-YYYYmmdd-HHMMSS.tar.gz -C /tmp/restore-test    # файлы
```

> Желательно дублировать `backups/` на внешнее хранилище (rsync/S3/rclone) —
> бэкап на той же машине не спасает от потери диска.

---

## 4. Отдача `/uploads` через nginx (минуя Node)

Уже внесено в [`deploy/nginx.conf.example`](./nginx.conf.example): блок `location /uploads/`
теперь `alias` на диск вместо `proxy_pass` в Node — большие файлы не грузят event-loop
приложения и кэшируются браузером.

Применить на сервере:
```bash
# 1) перенести изменения location /uploads/ в /etc/nginx/sites-available/memory-moments
# 2) убедиться, что alias совпадает с реальным UPLOAD_DIR (см. .env; default
#    .../marketplace/server/uploads/)
sudo nginx -t && sudo systemctl reload nginx
# проверка: curl -I https://memory-moments.online/uploads/<существующий-файл>.png
```

---

## Чек-лист после применения
- [ ] `pm2 conf pm2-logrotate` показывает заданные лимиты
- [ ] монитор на `/api/health` активен и шлёт алерт (проверить «учебной» остановкой)
- [ ] `bash deploy/backup.sh` отработал, и тестовый restore прошёл
- [ ] `curl -I .../uploads/<file>` отдаёт `200` от nginx (заголовок `Server: nginx`, есть `Cache-Control`)
