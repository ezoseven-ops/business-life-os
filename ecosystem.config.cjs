module.exports = {
  apps: [
    {
      name: 'blos-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/opt/blos',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 2,
      node_args: '--max-old-space-size=512',
      max_memory_restart: '1G',
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/blos/error.log',
      out_file: '/var/log/blos/out.log',
    },
  ],
}
