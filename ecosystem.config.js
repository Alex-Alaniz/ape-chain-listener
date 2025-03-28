
export default {
  apps: [{
    name: "blockchain-listener",
    script: "server.js",
    watch: true,
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "300M",
    restart_delay: 3000,
    exp_backoff_restart_delay: 100,
    // Restart every 30 minutes to maintain connection health
    cron_restart: "*/30 * * * *",
    env: {
      NODE_ENV: "production",
    }
  }]
};
