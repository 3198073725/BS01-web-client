const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave: false,
  devServer: {
    client: { overlay: process.env.VUE_APP_OVERLAY !== '0' },
    allowedHosts: 'all',
    host: '0.0.0.0',
    port: 8080,
  }
})
