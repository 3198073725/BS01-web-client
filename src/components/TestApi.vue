<template>
  <div class="page">
    <h1>后端接口验证面板</h1>

    <section class="card">
      <h2>后端地址</h2>
      <div class="row">
        <input v-model.trim="base" placeholder="http://192.168.183.131:8000" />
        <button @click="saveBase">保存</button>
        <span class="muted">当前：{{ api.getBase() }}</span>
      </div>
    </section>

    <section class="card">
      <h2>注册 / 登录</h2>
      <div class="row">
        <input v-model.trim="reg.username" placeholder="用户名" />
        <input v-model.trim="reg.email" placeholder="邮箱" />
        <input v-model="reg.password" placeholder="密码" type="password" />
        <button @click="register">注册</button>
      </div>
      <div class="row">
        <input v-model.trim="loginForm.username" placeholder="用户名" />
        <input v-model="loginForm.password" placeholder="密码" type="password" />
        <button @click="login">登录</button>
        <button @click="loadMe">获取我的信息</button>
      </div>
      <pre class="json" v-if="me">{{ me }}</pre>
    </section>

    <section class="card">
      <h2>邮箱验证 / 重置密码</h2>
      <div class="row">
        <button @click="sendVerifyEmail">发送验证邮件</button>
        <span class="muted">查看后端控制台或收件箱</span>
      </div>
      <div class="row">
        <input v-model.trim="resetEmail" placeholder="用于重置的邮箱" />
        <button @click="passwordReset">发送重置邮件</button>
      </div>
    </section>

    <section class="card">
      <h2>头像上传（可选裁剪 x/y/w/h）</h2>
      <div class="row">
        <input type="file" accept="image/*" @change="onFile" />
        <input v-model.number="crop.x" placeholder="x" type="number" />
        <input v-model.number="crop.y" placeholder="y" type="number" />
        <input v-model.number="crop.w" placeholder="w" type="number" />
        <input v-model.number="crop.h" placeholder="h" type="number" />
        <button @click="uploadAvatar" :disabled="!file">上传</button>
      </div>
      <div class="row" v-if="avatar">
        <div>
          <div class="muted">大图</div>
          <img :src="fullUrl(avatar)" class="img" />
        </div>
        <div v-if="avatarThumb">
          <div class="muted">缩略图</div>
          <img :src="fullUrl(avatarThumb)" class="img" />
        </div>
      </div>
    </section>

    <section class="card">
      <h2>关注 / 取关</h2>
      <div class="row">
        <input v-model.trim="followUser" placeholder="目标用户名" />
        <button @click="doFollow">关注</button>
        <button @click="doUnfollow">取关</button>
      </div>
    </section>

    <section class="card">
      <h2>粉丝/关注列表</h2>
      <div class="row">
        <input v-model.trim="listUser" placeholder="用户名（留空=我）" />
        <button @click="loadFollowers">粉丝列表</button>
        <button @click="loadFollowing">关注列表</button>
      </div>
      <ul v-if="list.length" class="list">
        <li v-for="u in list" :key="u.id">
          <strong>@{{ u.username }}</strong>
          <span class="muted">（{{ u.display_name || u.nickname || u.username }}）</span>
        </li>
      </ul>
    </section>

    <section v-if="err" class="error">
      <div>错误：{{ err.code }} - {{ err.detail }}（HTTP {{ err.status }}）</div>
      <pre class="json">{{ err.errors }}</pre>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { api } from '../api'

const base = ref(api.getBase())
function saveBase() {
  api.setBase(base.value)
  try { localStorage.setItem('api_base', api.getBase()) } catch(_) { void 0 }
}

const reg = ref({ username: '', email: '', password: '' })
const loginForm = ref({ username: '', password: '' })
const me = ref(null)
const resetEmail = ref('')
const crop = ref({ x: null, y: null, w: null, h: null })
const file = ref(null)
const avatar = ref('')
const avatarThumb = ref('')
const followUser = ref('')
const listUser = ref('')
const list = ref([])
const err = ref(null)

function fullUrl(rel) { return `${api.getBase()}/media/${rel}` }
function clearErr() { err.value = null }

async function register() {
  clearErr()
  try {
    await api.register(reg.value)
    alert('注册成功，请使用登录表单登录。')
  } catch (e) { err.value = e }
}

async function login() {
  clearErr()
  try {
    await api.login(loginForm.value.username, loginForm.value.password)
    await loadMe()
  } catch (e) { err.value = e }
}

async function loadMe() {
  clearErr()
  try {
    me.value = await api.me()
  } catch (e) { err.value = e }
}

async function sendVerifyEmail() {
  clearErr()
  try { await api.sendVerifyEmail(); alert('发送成功（请查看控制台或邮箱）') } catch (e) { err.value = e }
}

async function passwordReset() {
  clearErr()
  try { await api.passwordResetRequest(resetEmail.value); alert('发送成功（总返回 204）') } catch (e) { err.value = e }
}

function onFile(ev) { file.value = ev.target.files && ev.target.files[0] }

async function uploadAvatar() {
  clearErr()
  try {
    const res = await api.avatarUpload(file.value, crop.value)
    avatar.value = res.profile_picture
    avatarThumb.value = res.profile_picture_thumb
    await loadMe()
  } catch (e) { err.value = e }
}

async function doFollow() {
  clearErr()
  try {
    const u = await api.userByUsername(followUser.value)
    await api.follow(u.id)
    alert('已关注')
  } catch (e) { err.value = e }
}

async function doUnfollow() {
  clearErr()
  try {
    const u = await api.userByUsername(followUser.value)
    await api.unfollow(u.id)
    alert('已取关')
  } catch (e) { err.value = e }
}

async function loadFollowers() {
  clearErr()
  try {
    let userId = null
    if (listUser.value) userId = (await api.userByUsername(listUser.value)).id
    const res = await api.followers(userId)
    list.value = Array.isArray(res) ? res : (res.results || [])
  } catch (e) { err.value = e }
}

async function loadFollowing() {
  clearErr()
  try {
    let userId = null
    if (listUser.value) userId = (await api.userByUsername(listUser.value)).id
    const res = await api.following(userId)
    list.value = Array.isArray(res) ? res : (res.results || [])
  } catch (e) { err.value = e }
}
</script>

<style scoped>
.page { max-width: 960px; margin: 24px auto; padding: 0 16px; font: 14px/1.6 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.row input[type="text"], .row input[type="password"], .row input[type="number"], .row input[type="email"], .row input { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 6px; }
button { padding: 8px 12px; background: #2563eb; color:#fff; border: none; border-radius: 6px; cursor: pointer; }
button:disabled { opacity: .6; cursor: not-allowed; }
.muted { color: #6b7280; font-size: 12px; }
.json { background: #0b1020; color: #d1f5ff; padding: 12px; border-radius: 8px; overflow:auto; }
.img { width: 128px; height: 128px; border-radius: 8px; object-fit: cover; border: 1px solid #e5e7eb; }
.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; }
.list { padding-left: 18px; }
</style>
