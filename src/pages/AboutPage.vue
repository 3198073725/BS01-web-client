<template>
  <div class="static-page">
    <h1>关于我们</h1>
    <p class="meta">最后更新：2026-01-21</p>
    <p>我们为创作者与品牌提供稳定、易用的视频创作与分发基础设施，帮助优质内容高效触达目标受众。</p>

    <h2>我们做什么</h2>
    <ul>
      <li>内容生产：上传、管理与批量操作，所见即所得；</li>
      <li>分发与互动：关注/粉丝、喜欢/收藏、观看历史与统计；</li>
      <li>账号体系：完善的资料与头像裁剪、隐私与权限控制；</li>
      <li>性能优化：媒体与缓存策略，兼顾清晰度与加载速度。</li>
    </ul>

    <h2>我们的优势</h2>
    <ul>
      <li>简洁一致的企业级交互与视觉规范；</li>
      <li>后端基于 Django + DRF，扩展性强、维护成本低；</li>
      <li>安全与合规内置：登录防护、频率限制、数据留痕；</li>
      <li>可替换式存储：本地媒体或对象存储，灵活部署。</li>
    </ul>

    <h2>合规与隐私</h2>
    <ul>
      <li>最小必要收集与用途限制；</li>
      <li>数据安全与访问控制，关键操作可审计；</li>
      <li>详见「服务条款」，隐私说明可按需提供独立页面。</li>
    </ul>

    <h2>版本与联系</h2>
    <ul>
      <li>当前版本：v1.0.0（演示）</li>
      <li>商务与支持：前往 <router-link to="/contact">联系</router-link> 页面</li>
    </ul>
    <p class="muted">以上为标准介绍模板，可根据品牌与业务场景替换细节。</p>
  </div>
</template>

<script>
export default { name: 'AboutPage' }
</script>

<style scoped>
.static-page { max-width: 960px; margin: 24px auto; padding: 28px 28px 24px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,.08); }
h1 { font-size: 30px; line-height: 1.3; margin: 0 0 14px; font-weight: 800; color: var(--text); letter-spacing: .2px; }
h2 { font-size: 20px; margin: 18px 0 10px; padding-left: 12px; position: relative; }
h2::before { content: ''; position: absolute; left: 0; top: 0.25em; width: 4px; height: 1.2em; border-radius: 4px; background: var(--btn-border); }
p { line-height: 1.8; margin: 8px 0; }
ul { list-style: none; padding: 0; margin: 6px 0 12px; }
ul li { position: relative; padding-left: 18px; margin: 6px 0; }
ul li::before { content: ''; position: absolute; left: 0; top: 0.6em; width: 8px; height: 8px; border-radius: 50%; background: var(--btn-border); }
.meta { color: var(--muted); font-size: 12px; margin: -2px 0 12px; }
.muted { color: var(--muted); }
</style>
