<template>
  <div class="terms-page">
    <header class="page-header">
      <h1>服务条款</h1>
      <p class="meta">最后更新：2026-01-21</p>
    </header>
    <p class="intro">为保障您的合法权益并维护平台秩序，请在使用前仔细阅读并同意本条款。继续使用即视为您已阅读、理解并同意受其约束。</p>
    
    <div class="grid">
      <div class="card">
        <h2>要点概览</h2>
        <ul>
          <li>账户安全：妥善保管凭据，异常请及时联系我们</li>
          <li>用户行为：不得发布违法、侵权、骚扰等不当内容</li>
          <li>知识产权：原创归属作者，含第三方素材须合法授权</li>
          <li>隐私保护：遵循最小必要原则与用途限制</li>
          <li>违规处理：情节不同，可能删除内容或限制/终止服务</li>
          <li>争议解决：优先协商，必要时按适用法及管辖解决</li>
        </ul>
      </div>

      <div class="card">
        <h2>账户与安全</h2>
        <ul>
          <li>妥善保管登录凭据，不得出租/共享/转让账户</li>
          <li>发现账户异常请及时联系我们处理</li>
          <li>因保管不当产生的风险由用户自行承担</li>
          <li>定期更新密码，启用双重认证提高安全性</li>
        </ul>
      </div>

      <div class="card">
        <h2>用户行为规范</h2>
        <ul>
          <li>禁止发布违法、侵权、骚扰、欺诈等不当内容</li>
          <li>禁止刷量、攻击、恶意爬虫、散播病毒等行为</li>
          <li>遵守法律法规与社区规则，尊重他人权益</li>
          <li>不得利用平台进行商业欺诈或非法活动</li>
        </ul>
      </div>

      <div class="card">
        <h2>内容与知识产权</h2>
        <ul>
          <li>原创内容版权归用户所有，平台尊重创作者权益</li>
          <li>含第三方素材须合法授权并注明来源</li>
          <li>为展示/分发/推广之目的，授予平台非独占、可撤销的使用许可</li>
          <li>侵权投诉渠道见联系页面，我们将及时处理</li>
        </ul>
      </div>

      <div class="card">
        <h2>隐私与数据保护</h2>
        <ul>
          <li>遵循最小必要收集原则，严格限制使用范围</li>
          <li>数据仅用于提供/改进服务与账号安全</li>
          <li>敏感数据加密存储，访问权限严格控制</li>
          <li>更多细则详见隐私政策页面</li>
        </ul>
      </div>

      <div class="card">
        <h2>未成年人保护</h2>
        <ul>
          <li>建议未成年人在监护指导下合理使用平台</li>
          <li>不应接触与年龄不符的内容</li>
          <li>监护人应加强对未成年人网络使用的引导</li>
          <li>平台将采取必要措施保护未成年人权益</li>
        </ul>
      </div>

      <div class="card">
        <h2>违规处理与申诉</h2>
        <ul>
          <li>视情节严重程度采取删除/屏蔽、限制功能、暂停或终止服务</li>
          <li>如有异议，可通过联系页面发起申诉</li>
          <li>申诉将在收到后 7 个工作日内处理并反馈</li>
          <li>恶意申诉可能导致账号限制</li>
        </ul>
      </div>

      <div class="card">
        <h2>服务变更与中断</h2>
        <ul>
          <li>基于运营/安全需要可变更、暂停或终止服务</li>
          <li>将尽合理努力提前告知用户重大变更</li>
          <li>因维护、升级等需要的服务中断将提前公告</li>
          <li>不可抗力导致的服务中断不承担责任</li>
        </ul>
      </div>

      <div class="card">
        <h2>免责声明</h2>
        <ul>
          <li>服务按现状提供，不保证特定目的适用性</li>
          <li>不可抗力或第三方原因导致的损失不承担相应责任</li>
          <li>用户自行承担使用服务产生的风险</li>
          <li>平台不对用户发布内容的真实性负责</li>
        </ul>
      </div>

      <div class="card">
        <h2>争议解决</h2>
        <ul>
          <li>适用您所在辖区的相关法律（强制性规范优先）</li>
          <li>争议优先通过友好协商解决</li>
          <li>协商不成，按管辖法院提起诉讼</li>
          <li>条款部分无效不影响其他条款效力</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
export default { name: 'TermsPage' }
</script>

<style scoped>
.terms-page {
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

@media (max-width: 640px) {
  .terms-page {
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
