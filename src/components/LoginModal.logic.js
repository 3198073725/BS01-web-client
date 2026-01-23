import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { api } from '../api'
import { validateEmail, validateCode, toErrorText } from '../utils/validation'
import { handleSendCodeError, handleCodeLoginError, handlePasswordLoginError } from '../utils/authErrors'

export function useLoginModal({ emit }) {
  const tab = ref('code')
  const email = ref('')
  const emailCode = ref('')
  const emailErr = ref('')
  const codeErr = ref('')
  const emailTouched = ref(false)
  const codeTouched = ref(false)
  const submitted = ref(false)
  const username = ref('')
  const password = ref('')
  const loading = ref(false)
  const countdown = ref(0)
  let timer = null
  function startCountdown(sec) {
    const s = Math.max(1, Math.floor(Number(sec) || 0))
    countdown.value = s
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) { clearInterval(timer); timer = null }
    }, 1000)
  }
  const qrSrc = ref('')
  let qrPoll = null
  let qrSession = ''

  function close() { emit('close') }

  function onEmailBlur() {
    emailTouched.value = true
    const v = validateEmail(email.value)
    emailErr.value = v.ok ? '' : v.message
  }
  function onCodeBlur() {
    codeTouched.value = true
    const v = validateCode(emailCode.value)
    codeErr.value = v.ok ? '' : v.message
  }
  function onUsernameBlur() {
    usernameTouched.value = true
    usernameErr.value = String(username.value || '').trim() ? '' : '请输入用户名'
  }
  function onPasswordBlur() {
    passwordTouched.value = true
    passwordErr.value = String(password.value || '').trim() ? '' : '请输入密码'
  }

  const showEmailErr = computed(() => submitted.value || emailTouched.value)
  const showCodeErr = computed(() => submitted.value || codeTouched.value)

  // 用户名/密码校验（与邮箱验证码风格一致）
  const usernameErr = ref('')
  const passwordErr = ref('')
  const usernameTouched = ref(false)
  const passwordTouched = ref(false)
  const showUsernameErr = computed(() => submitted.value || usernameTouched.value)
  const showPasswordErr = computed(() => submitted.value || passwordTouched.value)

  async function sendCode() {
    emailTouched.value = true
    const v = validateEmail(email.value)
    emailErr.value = v.ok ? '' : v.message
    if (!v.ok) return
    loading.value = true
    try {
      await api.sendLoginCode(email.value)
      startCountdown(60)
    } catch (e) {
      handleSendCodeError(e, { startCountdown, setEmailErr: v => { emailErr.value = v } })
    } finally {
      loading.value = false
    }
  }

  async function submitCodeLogin() {
    submitted.value = true
    const v1 = validateEmail(email.value)
    const v2 = validateCode(emailCode.value)
    emailErr.value = v1.ok ? '' : v1.message
    codeErr.value = v2.ok ? '' : v2.message
    if (!v1.ok || !v2.ok) return
    loading.value = true
    try {
      await api.loginWithCode(email.value, emailCode.value)
      const me = await api.me()
      emit('logged-in', me)
      close()
    } catch (e) {
      handleCodeLoginError(e, {
        email: email.value,
        emailCode: emailCode.value,
        setEmailErr: v => { emailErr.value = v },
        setCodeErr: v => { codeErr.value = v },
      })
    } finally {
      loading.value = false
    }
  }

  async function submitPassword() {
    submitted.value = true
    // 本地必填校验
    usernameTouched.value = true
    passwordTouched.value = true
    usernameErr.value = String(username.value || '').trim() ? '' : '请输入用户名'
    passwordErr.value = String(password.value || '').trim() ? '' : '请输入密码'
    if (usernameErr.value || passwordErr.value) return

    loading.value = true
    try {
      await api.login(username.value, password.value)
      const me = await api.me()
      emit('logged-in', me)
      close()
    } catch (e) {
      if (!handlePasswordLoginError(e, { setUsernameErr: v => { usernameErr.value = v }, setPasswordErr: v => { passwordErr.value = v } })) {
        const status = (e && typeof e.status === 'number') ? e.status : 0
        const msg = toErrorText(e)
        if (status === 401) {
          // 401：凭证错误，进一步探测用户名是否存在
          try {
            await api.userByUsername(String(username.value || ''))
            // 用户存在 → 密码错误
            usernameErr.value = ''
            passwordErr.value = '密码错误'
          } catch (_) {
            // 用户不存在
            usernameErr.value = '用户名不存在，请注册'
            passwordErr.value = ''
          }
        } else if (/用户名|不存在|未找到|no\s+such|not\s+found|username/i.test(msg)) {
          usernameErr.value = '用户名不存在，请注册'
          passwordErr.value = ''
        } else if (/密码|password/i.test(msg)) {
          passwordErr.value = '密码错误'
        } else if (/credentials|active\s+account/i.test(msg)) {
          // 某些后端文案（英文）
          try {
            await api.userByUsername(String(username.value || ''))
            usernameErr.value = ''
            passwordErr.value = '密码错误'
          } catch (_) {
            usernameErr.value = '用户名不存在，请注册'
            passwordErr.value = ''
          }
        } else {
          passwordErr.value = msg || '登录失败，请重试'
        }
      }
    } finally {
      loading.value = false
    }
  }

  async function initQr() {
    try {
      const data = await api.qrCreate()
      qrSession = data.session
      qrSrc.value = data.qr_image || data.qr_url || ''
      if (qrPoll) clearInterval(qrPoll)
      qrPoll = setInterval(async () => {
        try {
          const st = await api.qrStatus(qrSession)
          if (st.status === 'confirmed') {
            // 后端应返回 JWT
            if (st.access && st.refresh) {
              api.setTokens({ access: st.access, refresh: st.refresh })
              const me = await api.me()
              emit('logged-in', me)
              close()
            }
            clearInterval(qrPoll); qrPoll = null
          }
        } catch (_) { /* ignore polling error */ }
      }, 3000)
    } catch (_) { /* ignore */ }
  }

  onMounted(() => { initQr() })
  onBeforeUnmount(() => { if (qrPoll) clearInterval(qrPoll); if (timer) clearInterval(timer) })

  return {
    tab, email, emailCode, emailErr, codeErr, emailTouched, codeTouched, submitted,
    username, password, loading, countdown, qrSrc,
    close, onEmailBlur, onCodeBlur, onUsernameBlur, onPasswordBlur,
    sendCode, submitCodeLogin, submitPassword,
    showEmailErr, showCodeErr, usernameErr, passwordErr, showUsernameErr, showPasswordErr,
  }
}
