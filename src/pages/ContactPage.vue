<template>
  <div class="static-page">
    <h1>联系我们</h1>
    <p class="meta">最后更新：2026-01-21</p>
    <p>如有合作、反馈、违规举报或版权问题，欢迎通过以下渠道与我们联系：</p>

    <h2>联系渠道</h2>
    <ul>
      <li>管理员邮箱：<a href="mailto:mediacms@126.com">mediacms@126.com</a></li>
      <li>社区支持：提交 Issue 或加入讨论组（如有）</li>
    </ul>

    <h2>服务时间</h2>
    <p>工作日 09:30–18:30（GMT+8），节假日顺延。复杂问题将在 48 小时内回复。</p>

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
        <div class="field">
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

    <h2>问题反馈/BUG 模板</h2>
    <ul>
      <li>概述：问题简述 + 期望结果；</li>
      <li>环境：浏览器/操作系统/网络；</li>
      <li>步骤：复现步骤 + 截图/录屏；</li>
      <li>时间：发生时间与频次。</li>
    </ul>

    <h2>侵权/违规投诉（DMCA）</h2>
    <p>如您认定平台内容侵犯了您的合法权益，请提交以下材料至 <a href="mailto:support@example.com">mediacms@126.com</a>：</p>
    <ul>
      <li>投诉方信息：姓名/公司、联系方式；</li>
      <li>权属证明：著作权/商标权/授权证明等；</li>
      <li>侵权内容信息：标题、作者、链接 URL（越完整越好）；</li>
      <li>声明：内容真实性与承担责任声明；</li>
      <li>签名：电子签名或盖章扫描件。</li>
    </ul>
    <p>我们将在核实后根据平台规则与法律要求采取处理并反馈进展。</p>

    <h2>隐私相关请求</h2>
    <p>如需导出、更正或删除个人数据，请通过支持邮箱联系并完成账号验证。</p>

    <h2>商务合作</h2>
    <p>欢迎与我们探讨品牌合作、内容共创与技术集成，请简述：</p>
    <ul>
      <li>合作方向与目标；</li>
      <li>预计周期与资源投入；</li>
      <li>对平台能力的需求（API、数据、组件等）。</li>
    </ul>

    <p class="muted">以上为示例邮箱/渠道，请替换为真实信息；如需在线表单，我可以在此页增加表单并接入后端。</p>
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
.static-page { max-width: 960px; margin: 24px auto; padding: 28px 28px 24px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,.08); }
h1 { font-size: 30px; line-height: 1.3; margin: 0 0 10px; font-weight: 800; color: var(--text); letter-spacing: .2px; }
.meta { color: var(--muted); font-size: 12px; margin: -2px 0 12px; }
h2 { font-size: 20px; margin: 18px 0 10px; padding-left: 12px; position: relative; }
h2::before { content: ''; position: absolute; left: 0; top: 0.25em; width: 4px; height: 1.2em; border-radius: 4px; background: var(--accent); }
p { line-height: 1.8; margin: 8px 0; }
ul { list-style: none; padding: 0; margin: 6px 0 12px; }
ul li { position: relative; padding-left: 18px; margin: 6px 0; }
ul li::before { content: ''; position: absolute; left: 0; top: 0.6em; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.muted { color: var(--muted); }
.form { border:1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--bg); }
.grid { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px 16px; }
.grid.single { grid-template-columns: 1fr; }
.field { display:flex; flex-direction:column; gap:6px; }
.field.full { grid-column: 1 / -1; }
.field input, .field select, .field textarea { padding:10px 12px; border:1px solid var(--border); background: var(--bg-elev); color: var(--text); border-radius:10px; outline:none; }
.actions { display:flex; align-items:center; gap:12px; margin-top: 10px; }
.btn { padding:8px 14px; border-radius:10px; border:1px solid var(--btn-border); background: var(--btn-bg); color: var(--text); cursor:pointer; }
.ok { color: #10b981; }
.err { color: var(--danger); }
.hint { color: var(--muted); font-size: 12px; margin-top: 8px; }
</style>
