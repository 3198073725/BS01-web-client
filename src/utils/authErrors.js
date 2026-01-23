import { toErrorText } from './validation'

export function handleSendCodeError(e, { startCountdown, setEmailErr }) {
  if (e && e.code === 'cooling_down') {
    const cd = Number.isFinite(e.cool_down_seconds) ? Math.max(1, Math.floor(e.cool_down_seconds)) : 60
    if (typeof startCountdown === 'function') startCountdown(cd)
    if (typeof setEmailErr === 'function') setEmailErr(`发送过于频繁，请 ${cd}s 后重试`)
    return true
  }
  if (e && e.code === 'daily_limit_reached') {
    const cd = Number.isFinite(e.cool_down_seconds) ? Math.max(1, Math.floor(e.cool_down_seconds)) : 3600
    if (typeof startCountdown === 'function') startCountdown(cd)
    if (typeof setEmailErr === 'function') setEmailErr('今日发送次数已达上限，请明日再试')
    return true
  }
  if (typeof setEmailErr === 'function') setEmailErr(toErrorText(e))
  return true
}

export function handleCodeLoginError(e, { email, emailCode, setEmailErr, setCodeErr }) {
  if (e && e.code === 'invalid_code') {
    if (typeof setCodeErr === 'function') setCodeErr('验证码错误')
    return true
  }
  if (e && e.code === 'code_expired') {
    if (typeof setCodeErr === 'function') setCodeErr('验证码已过期，请重新获取')
    return true
  }
  if (e && e.code === 'cooling_down') {
    const cd = Number.isFinite(e.cool_down_seconds) ? Math.max(1, Math.floor(e.cool_down_seconds)) : 60
    if (typeof setCodeErr === 'function') setCodeErr(`尝试过于频繁，请 ${cd}s 后再试`)
    return true
  }
  if (e && e.code === 'missing_params') {
    const msg = toErrorText(e)
    if (!email && typeof setEmailErr === 'function') setEmailErr('请输入邮箱')
    if (!emailCode && typeof setCodeErr === 'function') setCodeErr('请输入验证码')
    if (typeof setCodeErr === 'function' && email && emailCode) setCodeErr(msg || '参数缺失')
    return true
  }
  const msg = toErrorText(e)
  if (/邮箱|email/i.test(msg)) {
    if (typeof setEmailErr === 'function') setEmailErr(msg)
  } else if (/验证码|code/i.test(msg)) {
    if (typeof setCodeErr === 'function') setCodeErr(msg)
  } else {
    if (typeof setCodeErr === 'function') setCodeErr(msg || '登录失败，请重试')
  }
  return true
}

export function handlePasswordLoginError(e, { setUsernameErr, setPasswordErr }) {
  if (e && e.code === 'cooling_down') {
    const cd = Number.isFinite(e.cool_down_seconds) ? Math.max(1, Math.floor(e.cool_down_seconds)) : 60
    if (typeof setUsernameErr === 'function') setUsernameErr('')
    if (typeof setPasswordErr === 'function') setPasswordErr(`尝试过于频繁，请 ${cd}s 后再试`)
    return true
  }
  const status = (e && typeof e.status === 'number') ? e.status : 0
  if (status === 401) return false
  const msg = toErrorText(e)
  if (/用户名|不存在|未找到|no\s+such|not\s+found|username/i.test(msg)) {
    if (typeof setUsernameErr === 'function') setUsernameErr('用户名不存在，请注册')
    if (typeof setPasswordErr === 'function') setPasswordErr('')
    return true
  }
  if (/密码|password/i.test(msg)) {
    if (typeof setPasswordErr === 'function') setPasswordErr('密码错误')
    return true
  }
  if (typeof setPasswordErr === 'function') setPasswordErr(msg || '登录失败，请重试')
  return true
}
