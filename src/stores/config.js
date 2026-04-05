import { defineStore } from 'pinia';
import { api } from '../api';

export const useConfigStore = defineStore('config', {
  state: () => ({
    configs: {},
    version: localStorage.getItem('config_version') || '0',
    loading: false
  }),
  actions: {
    async fetchConfigs() {
      this.loading = true;
      try {
        const data = await api.globalConfigs();
        const newVersion = String(data.config_version || '0');
        
        // 如果版本号变更，且不是第一次加载（version不为0），则强制刷新
        if (this.version !== '0' && this.version !== newVersion) {
          localStorage.setItem('config_version', newVersion);
          window.location.reload();
          return;
        }
        
        this.configs = data;
        this.version = newVersion;
        localStorage.setItem('config_version', newVersion);
      } catch (e) {
        console.error('Failed to fetch global configs:', e);
      } finally {
        this.loading = false;
      }
    }
  },
  getters: {
    get: (state) => (key, defaultValue = true) => {
      const val = state.configs[key];
      if (val === undefined || val === null) return defaultValue;
      return val;
    }
  }
});
