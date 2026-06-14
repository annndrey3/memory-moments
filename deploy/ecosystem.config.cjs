// PM2 process config для Memory Moments API.
// Запуск:  pm2 start deploy/ecosystem.config.cjs
// Переменные окружения берутся из marketplace/server/.env (через dotenv).
module.exports = {
  apps: [
    {
      name: "mm-api",
      // путь до сервера относительно места запуска pm2 (или укажите абсолютный)
      cwd: "./t-shirt-designer-webapp-main/marketplace/server",
      script: "src/index.js",
      instances: 1,
      exec_mode: "fork", // SQLite — один процесс (не cluster!)
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
