<template>
  <div class="overlay" @click.self="close">
    <div class="modal">
      <div class="header">
        <div class="title">登录后免费畅享高清视频</div>
        <button class="icon-btn" @click="close">✕</button>
      </div>
      <div class="body">
        <div class="left">
          <div class="subtitle">扫码登录</div>
          <div class="qr">
            <img :src="qrSrc" alt="QR" />
          </div>
          <div class="hint">打开「App」点击左上角 ≡ 扫一扫</div>
        </div>
        <div class="vline"></div>
        <div class="right">
          <div class="tabs">
            <button :class="['tab', tab==='code' && 'active']" @click="tab='code'">验证码登录</button>
            <button :class="['tab', tab==='password' && 'active']" @click="tab='password'">密码登录</button>
          </div>
          <div v-if="tab==='code'" class="panel">
            <div class="row">
              <input v-model.trim="email" type="email" placeholder="请输入邮箱" class="input" @blur="onEmailBlur" />
            </div>
            <div class="err-line" aria-live="polite">{{ showEmailErr ? emailErr : '' }}</div>
            <div class="row">
              <input v-model.trim="emailCode" placeholder="请输入验证码" class="input" @blur="onCodeBlur" />
              <button class="btn code-btn" :disabled="countdown>0 || loading" @click="sendCode">{{ countdown>0 ? `${countdown}s` : '获取验证码' }}</button>
            </div>
            <div class="err-line" aria-live="polite">{{ showCodeErr ? codeErr : '' }}</div>
            <button class="btn primary" :disabled="loading" @click="submitCodeLogin">{{ loading? '处理中...' : (allowRegister ? '登录/注册' : '登录') }}</button>
            <div class="agreements">{{ allowRegister ? '登录或注册即代表同意 ' : '登录即代表同意 ' }}<router-link to="/agreement" @click="$emit('close')">用户协议</router-link> 和
  <router-link to="/privacy" @click="$emit('close')">隐私政策</router-link></div>
          </div>
          <div v-else class="panel">
            <div class="row">
              <input v-model.trim="username" placeholder="用户名" class="input" @blur="onUsernameBlur" />
            </div>
            <div class="err-line" aria-live="polite">{{ showUsernameErr ? usernameErr : '' }}</div>
            <div class="row">
              <input v-model="password" type="password" placeholder="密码" class="input" @blur="onPasswordBlur" />
            </div>
            <div class="err-line" aria-live="polite">{{ showPasswordErr ? passwordErr : '' }}</div>
            <button class="btn primary" :disabled="loading" @click="submitPassword">{{ loading? '登录中...' : '登录' }}</button>
            <div class="agreements">登录即代表同意 <router-link to="/agreement" @click="$emit('close')">用户协议</router-link> 和
  <router-link to="/privacy" @click="$emit('close')">隐私政策</router-link></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useLoginModal } from './LoginModal.logic.js'
const emit = defineEmits(['close', 'logged-in'])
const configStore = useConfigStore()
const allowRegister = computed(() => configStore.get('allow_register', true))
const {
  tab, email, emailCode, emailErr, codeErr, username, password, loading, countdown, qrSrc,
  close, onEmailBlur, onCodeBlur, onUsernameBlur, onPasswordBlur,
  sendCode, submitCodeLogin, submitPassword,
  showEmailErr, showCodeErr, usernameErr, passwordErr, showUsernameErr, showPasswordErr,
} = useLoginModal({ emit })
</script>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; z-index: 1000; }
.modal { width: 880px; background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.header { position: relative; padding: 20px 24px; }
.title { text-align:center; font-size: 22px; font-weight: 800; color:#111827; }
.icon-btn { position:absolute; right:16px; top:16px; border:none; background:transparent; font-size:20px; cursor:pointer; color:#6b7280; }
.body { display:flex; padding: 0px 24px 24px; gap: 24px; }
.left { width: 360px; display:flex; flex-direction:column; align-items:center; }
.subtitle { color:#6b7280; margin: 6px 0 12px; }
.qr { width: 272px; height: 272px; background: #fff; border: 1px solid #eceff3; border-radius: 16px; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 8px rgba(17,24,39,.06) inset; }
.qr img { width: 248px; height: 248px; }
.hint { color:#9ca3af; margin-top: 12px; font-size: 12px; }
.vline { width:1px; background:#f1f5f9; margin: 0 4px; }
.right { flex:1; }
.tabs { display:flex; gap: 18px; border-bottom: 1px solid #f1f5f9; margin: 4px 0 16px; }
.tab { background:transparent; border:none; padding: 12px 4px; cursor:pointer; color:#9ca3af; font-weight:700; }
.tab.active { color:#111827; border-bottom: 2px solid #f472b6; }
.panel { display:flex; flex-direction:column; gap: 16px; }
.row { display:flex; gap: 10px; align-items:center; }
.input { flex:1; padding: 14px 16px; border: 1px solid #eef0f4; background:#f8fafc; border-radius: 14px; }
.err-line { min-height: 16px; color:#ef4444; font-size:12px; margin-left:6px; }
.btn { padding: 12px 16px; border-radius: 14px; border: 1px solid #e5e7eb; background:#f3f4f6; cursor:pointer; }
.btn.code-btn { background:#fff; }
.btn.primary { background: #f472b6; color:#fff; border: none; height: 46px; font-weight:700; }
.agreements { color:#6b7280; font-size: 12px; margin-top: 6px; }
.agreements a { color:#6b7280; text-decoration: underline; }
</style>
