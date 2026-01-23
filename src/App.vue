<template>
  <router-view />
  
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
/* Theme variables */
:root, [data-theme="dark"] {
  --bg: #0b0e12;
  --bg-elev: #0f141a;
  --text: #e5e7eb;
  --muted: #9ca3af;
  --border: #1f2937;
  --btn-bg: #1f2937;
  --btn-border: #374151;
  --hover-bg: #1f2937;
  --active-bg: #111827;
  --accent: #22d3ee;
  --danger: #f43f5e;
  --sidebar-w: 180px;
  --topbar-h: 56px;
  --player-max-w: 1400px;
  --aspect: 16/9;
  --overlay: rgba(0,0,0,.55);
}
[data-theme="light"] {
  --bg: #f8fafc;
  --bg-elev: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --btn-bg: #f3f4f6;
  --btn-border: #e5e7eb;
  --hover-bg: #f3f4f6;
  --active-bg: #e5e7eb;
  --accent: #0ea5e9;
  --danger: #ef4444;
  --sidebar-w: 180px;
  --topbar-h: 56px;
  --player-max-w: 1400px;
  --aspect: 16/9;
  --overlay: rgba(0,0,0,.35);
}
html, body, #app { height: 100%; overflow: hidden; }
body { margin: 0; background: var(--bg); color: var(--text); }
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
}
* {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
</style>
