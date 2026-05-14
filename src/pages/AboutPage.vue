<template>
  <div class="about-page">
    <header class="page-header">
      <h1>关于我们</h1>
      <p class="meta">最后更新：2026-01-21</p>
    </header>
    <p class="intro">我们为创作者与品牌提供稳定、易用的视频创作与分发基础设施，帮助优质内容高效触达目标受众。</p>
    
    <div class="grid">
      <div class="card">
        <h2>我们做什么</h2>
        <ul>
          <li>内容生产：支持多种格式视频上传、智能转码、批量管理与编辑，提供所见即所得的预览体验</li>
          <li>分发与互动：关注/粉丝体系、喜欢/收藏功能、观看历史记录、详细的数据统计分析</li>
          <li>账号体系：完善的用户资料管理、头像裁剪上传、隐私设置与权限控制、安全认证</li>
          <li>性能优化：智能媒体处理、多级缓存策略、CDN 加速分发，兼顾高清画质与快速加载</li>
          <li>移动端支持：响应式设计，完美适配手机、平板、桌面等各种设备</li>
        </ul>
      </div>

      <div class="card">
        <h2>我们的优势</h2>
        <ul>
          <li>简洁一致：企业级交互设计规范，统一的视觉语言，降低学习成本</li>
          <li>技术架构：后端基于 Django + Django REST Framework，扩展性强、维护成本低、社区支持完善</li>
          <li>安全合规：内置登录防护、API 频率限制、操作日志留痕、数据加密存储</li>
          <li>灵活部署：支持本地媒体存储或对象存储（S3/OSS），可私有化部署或云端部署</li>
          <li>高性能：异步任务处理、数据库优化、缓存策略，支持高并发访问</li>
          <li>可扩展：模块化设计，支持插件扩展，满足不同业务场景需求</li>
        </ul>
      </div>

      <div class="card">
        <h2>合规与隐私</h2>
        <ul>
          <li>数据最小化：仅收集业务必需的信息，严格限制使用范围</li>
          <li>安全存储：敏感数据加密存储，访问权限严格控制，定期安全审计</li>
          <li>透明可控：用户可查看和管理个人信息，支持数据导出与删除请求</li>
          <li>法律合规：遵循相关法律法规要求，提供完整的用户协议与隐私政策</li>
          <li>操作留痕：关键操作记录日志，可追溯可审计，保障数据安全</li>
        </ul>
      </div>

      <div class="card">
        <h2>版本与联系</h2>
        <ul>
          <li>当前版本：v1.0.0（演示版本）</li>
          <li>技术栈：Vue 3 + Django + PostgreSQL + Redis</li>
          <li>开源协议：遵循 MIT 开源协议</li>
          <li>商务合作：前往 <router-link to="/contact">联系</router-link> 页面获取联系方式</li>
          <li>技术支持：通过 GitHub Issues 或邮件反馈问题</li>
          <li>持续更新：定期发布功能更新与安全补丁</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
export default { name: 'AboutPage' }
</script>

<style scoped>
.about-page {
  padding: 24px;
  color: var(--text);
}

.page-header {
  margin-bottom: 24px;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--text);
}

.meta {
  color: var(--muted);
  font-size: 13px;
  margin: 0;
}

.intro {
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 32px;
  color: var(--text);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}

.card h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--text);
  padding-bottom: 12px;
  border-bottom: 2px solid var(--btn-border);
}

.card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.card li {
  position: relative;
  padding-left: 20px;
  margin: 10px 0;
  line-height: 1.5;
  font-size: 14px;
}

.card li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.card a {
  color: var(--accent);
  text-decoration: none;
}

.card a:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .about-page {
    padding: 16px;
  }
  
  .grid {
    grid-template-columns: 1fr;
  }
  
  h1 {
    font-size: 24px;
  }
}
</style>
