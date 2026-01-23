<template>
  <div class="static-page">
    <h1>设置</h1>
    <p>在这里可以配置账户相关选项（占位示例）。后续可扩展：通知偏好、安全设置、显示与主题、隐私设置等。</p>
    <ul>
      <li>通知偏好：站内信、邮件、推送</li>
      <li>安全设置：修改密码、绑定邮箱/手机、二次验证</li>
      <li>显示与主题：深色/浅色、字号</li>
      <li>隐私：谁可以看到我的主页与内容</li>
    </ul>
    <p class="muted">本页面为占位内容，可按实际需求拆分为多个子页。</p>
  </div>
</template>

<script>
export default { name: 'SettingsPage' }
</script>

<style scoped>
.static-page { max-width: 880px; margin: 24px auto; padding: 16px; color: var(--text); }
h1 { font-size: 28px; margin: 0 0 12px; }
p { line-height: 1.8; }
ul { padding-left: 20px; }
.muted { color: var(--muted); }
</style>
