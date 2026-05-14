<template>
  <div class="contact-page">
    <header class="page-header">
      <h1>联系我们</h1>
      <p class="meta">最后更新：2026-01-21</p>
    </header>
    <p class="intro">如有合作、反馈、违规举报或版权问题，欢迎通过以下渠道与我们联系：</p>
    
    <div class="grid">
      <div class="card">
        <h2>联系渠道</h2>
        <ul>
          <li>管理员邮箱：<a href="mailto:mediacms@126.com">mediacms@126.com</a></li>
          <li>社区支持：提交 Issue 或加入讨论组（如有）</li>
          <li>技术文档：查看 API 文档获取开发支持</li>
        </ul>
      </div>

      <div class="card">
        <h2>服务时间</h2>
        <ul>
          <li>工作日 09:30–18:30（GMT+8）</li>
          <li>节假日顺延处理</li>
          <li>复杂问题将在 48 小时内回复</li>
          <li>紧急问题请标注【紧急】</li>
        </ul>
      </div>

      <div class="card">
        <h2>快速链接</h2>
        <ul>
          <li><router-link to="/about">关于我们</router-link></li>
          <li><router-link to="/agreement">用户协议</router-link></li>
          <li><router-link to="/privacy">隐私政策</router-link></li>
          <li><router-link to="/terms">服务条款</router-link></li>
        </ul>
      </div>

      <div class="card">
        <h2>常见问题</h2>
        <ul>
          <li>如何上传视频？</li>
          <li>如何修改个人信息？</li>
          <li>如何设置隐私权限？</li>
          <li>更多问题请查看帮助文档</li>
        </ul>
      </div>

      <div class="card full-width">
        <h2>在线联系表单</h2>
        <form class="form" @submit.prevent="submit">
          <div class="grid single">
            <div class="field">
              <label for="email">邮箱（必填）</label>
              <input id="email" v-model.trim="form.email" type="email" maxlength="120" />
            </div>
            <div class="field">
              <label for="name">姓名（选填）</label>
              <input id="name" v-model.trim="form.name" type="text" maxlength="60" />
            </div>
            <div class="field full">
              <label for="message">内容（必填）</label>
              <textarea id="message" v-model.trim="form.message" rows="5" maxlength="4000"></textarea>
            </div>
          </div>
          <div class="hint">优先通过服务端投递到管理员邮箱；异常时会自动尝试打开邮件客户端。</div>
          <div class="actions">
            <button class="btn" type="submit" :disabled="!canSubmit || loading">{{ loading ? '提交中...' : '提交' }}</button>
            <span v-if="ok" class="ok">已提交，我们会尽快联系</span>
            <span v-if="err" class="err">{{ err }}</span>
          </div>
        </form>
      </div>

      <div class="card">
        <h2>问题反馈/BUG 模板</h2>
        <ul>
          <li>概述：问题简述 + 期望结果</li>
          <li>环境：浏览器/操作系统/网络</li>
          <li>步骤：复现步骤 + 截图/录屏</li>
          <li>时间：发生时间与频次</li>
        </ul>
      </div>

      <div class="card">
        <h2>侵权/违规投诉（DMCA）</h2>
        <p>如您认定平台内容侵犯了您的合法权益，请提交以下材料至 <a href="mailto:mediacms@126.com">mediacms@126.com</a>：</p>
        <ul>
          <li>投诉方信息：姓名/公司、联系方式</li>
          <li>权属证明：著作权/商标权/授权证明等</li>
          <li>侵权内容信息：标题、作者、链接 URL</li>
          <li>声明：内容真实性与承担责任声明</li>
          <li>签名：电子签名或盖章扫描件</li>
        </ul>
      </div>

      <div class="card">
        <h2>隐私相关请求</h2>
        <ul>
          <li>数据导出：申请导出个人数据</li>
          <li>数据更正：更正错误的个人信息</li>
          <li>数据删除：申请删除账户及相关数据</li>
          <li>通过支持邮箱联系并完成账号验证</li>
        </ul>
      </div>

      <div class="card">
        <h2>商务合作</h2>
        <p>欢迎与我们探讨品牌合作、内容共创与技术集成，请简述：</p>
        <ul>
          <li>合作方向与目标</li>
          <li>预计周期与资源投入</li>
          <li>对平台能力的需求（API、数据、组件等）</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, ref, computed } from 'vue'
import { api } from '../api'
export default {
  name: 'ContactPage',
  setup() {
    const form = reactive({ type: 'other', name: '', email: '', subject: '', message: '' })
    const loading = ref(false)
    const ok = ref(false)
    const err = ref('')
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const canSubmit = computed(() => emailRe.test(form.email) && !!form.message && !loading.value)
    function buildMailto() {
      const to = 'mediacms@126.com'
      const s = (form.subject && form.subject.trim()) ? form.subject.trim() : (form.message ? (form.message.length > 30 ? form.message.slice(0,30) + '...' : form.message) : '联系表单')
      const sbj = `[Contact] ${s}`
      const body = [
        `姓名: ${form.name}`,
        `邮箱: ${form.email}`,
        `类型: ${form.type}`,
        '',
        form.message
      ].join('\n')
      const href = `mailto:${to}?subject=${encodeURIComponent(sbj)}&body=${encodeURIComponent(body)}`
      return href
    }
    async function submit() {
      err.value = ''
      ok.value = false
      if (!canSubmit.value) return
      loading.value = true
      try {
        await api.contactSubmit({
          type: form.type,
          name: form.name,
          email: form.email,
          subject: form.subject,
          message: form.message,
        })
        ok.value = true
      } catch (e) {
        // 后端失败则回退到 mailto
        try {
          const href = buildMailto()
          const w = window.open(href, '_self')
          if (w !== null) {
            ok.value = true
            err.value = '服务暂不可用，已为您打开邮件客户端'
          } else {
            err.value = (e && e.detail) ? String(e.detail) : '发送失败，请稍后再试'
          }
        } catch (_) {
          err.value = (e && e.detail) ? String(e.detail) : '发送失败，请稍后再试'
        }
      } finally {
        loading.value = false
      }
    }
    return { form, loading, ok, err, canSubmit, submit }
  }
}
</script>

<style scoped>
.contact-page {
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

.card.full-width {
  grid-column: 1 / -1;
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

.card p {
  margin: 10px 0;
  line-height: 1.5;
  font-size: 14px;
}

.card a {
  color: var(--accent);
  text-decoration: none;
}

.card a:hover {
  text-decoration: underline;
}

.form {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  background: var(--bg);
}

.form .grid {
  gap: 16px;
  margin-bottom: 16px;
}

.form .grid.single {
  grid-template-columns: 1fr;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field.full {
  grid-column: 1 / -1;
}

.field label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.field input,
.field textarea {
  padding: 12px 14px;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  color: var(--text);
  border-radius: 10px;
  outline: none;
  font-size: 14px;
}

.field input:focus,
.field textarea:focus {
  border-color: var(--accent);
}

.hint {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 16px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid var(--btn-border);
  background: var(--btn-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn:hover:not(:disabled) {
  background: var(--hover-bg);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ok {
  color: #10b981;
  font-size: 14px;
}

.err {
  color: var(--danger);
  font-size: 14px;
}

@media (max-width: 640px) {
  .contact-page {
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
