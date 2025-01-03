module.exports = {
  apps: [
    {
      name: "ai-web-tz",
      script: "npm",
      args: "start",
      instances: "1",
      autorestart: true,
      watch: false,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "production",
      },
      output: "/var/log/ai-web-tz/out.log", // 标准输出日志路径
      error: "/var/log/ai-web-tz/error.log", // 标准错误日志路径
      combine_logs: true, // 将 stdout 和 stderr 合并到一个日志文件
    },
  ],
};
