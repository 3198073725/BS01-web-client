<template>
  <div class="privacy-page">
    <header class="page-header">
      <button class="back-btn" @click="$router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        返回
      </button>
      <h1>隐私政策</h1>
      <p class="date-info">最后更新：2025年12月10日</p>
    </header>
    <main class="content">
      <article>
        <p>本平台（以下简称「我们」）深知个人信息对您的重要性，并会尽全力保护您的个人信息安全可靠。我们承诺将按业界成熟的安全标准，采取相应的安全保护措施来保护您的个人信息。</p>

        <h2>信息收集</h2>
        <p>我们收集您的信息主要用于向您提供服务并改善服务体验。这些信息包括但不限于：</p>
        <ul>
          <li>您在注册账户时提供的信息，如用户名、邮箱地址、手机号码等。</li>
          <li>您使用服务时产生的日志信息，如 IP 地址、浏览器类型、访问日期和时间等。</li>
          <li>您主动上传或发布的图片、视频、文本等内容。</li>
        </ul>

        <h2>信息使用</h2>
        <p>我们可能将所收集的信息用于以下用途：</p>
        <ul>
          <li>向您提供、维护、改进我们的产品和服务；</li>
          <li>处理您的查询、投诉或反馈；</li>
          <li>向您发送与服务相关的通知，如验证码、系统公告等；</li>
          <li>进行内部审计、数据分析和研究，以改善用户体验。</li>
        </ul>

        <h2>信息共享</h2>
        <p>我们不会将您的个人信息转让给任何公司、组织和个人，但以下情形除外：</p>
        <ul>
          <li>事先获得您的明确同意或授权；</li>
          <li>根据法律法规、法律程序或政府主管部门的强制性要求；</li>
          <li>与我们的关联公司或合作伙伴共享，但仅用于实现本政策声明的目的，且受本隐私政策的约束。</li>
        </ul>

        <h2>信息安全</h2>
        <p>我们已采用符合业界标准的安全防护措施保护您提供的个人信息，防止数据遭到未经授权访问、公开披露、使用、修改、损坏或丢失。我们会采取一切合理可行的措施，确保未收集无关的个人信息。我们只会在达成本政策所述目的所需的期限内保留您的个人信息，除非需要延长保留期或受到法律的允许。</p>

        <h2>Cookie 和同类技术</h2>
        <p>为保证网站正常运行，帮助您获得更轻松的访问体验，我们会在您的计算机或移动设备上存储名为 Cookie 的小数据文件。Cookie 通常包含标识符、站点名称以及一些数字和字符。您可根据自己的偏好管理或删除 Cookie。但请注意，禁用 Cookie 可能会影响您使用部分服务功能。</p>

        <h2>政策更新</h2>
        <p>我们可能适时修订本隐私政策。未经您明确同意，我们不会削减您按照本隐私政策所应享有的权利。对于重大变更，我们会提供显著的通知（例如通过弹窗、邮件或在页面显著位置提醒）。</p>

        <p>如果您对本隐私政策有任何疑问，请联系我们：MediaCMS@126.com。</p>
      </article>
    </main>
  </div>
</template>

<script setup>
// 无需额外逻辑
</script>

<style scoped>
.privacy-page {
  padding: 20px;
  color: var(--text);
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background 0.2s;
}
.back-btn:hover {
  background: var(--hover-bg);
}

h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}

.date-info {
  margin-left: auto;
  font-size: 13px;
  color: var(--muted);
}

.content {
  max-width: 100%;
}

article {
  padding: 0;
  text-align: justify;
}

h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 28px 0 12px;
  color: var(--text);
}

p {
  margin: 12px 0;
  color: var(--text);
  line-height: 1.6;
}

ul {
  margin: 8px 0 16px;
  padding-left: 24px;
  color: var(--text);
}

li {
  margin: 6px 0;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .privacy-page {
    padding: 12px;
  }
  
  .page-header {
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .date-info {
    margin-left: 0;
    width: 100%;
  }
  
  h1 {
    font-size: 20px;
  }
  
  h2 {
    font-size: 16px;
  }
}
</style>