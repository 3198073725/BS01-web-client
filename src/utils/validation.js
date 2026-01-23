// Simple client-side validations for login forms
// Note: Server-side will perform stricter checks (blacklist/disposable/MX).

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function validateEmail(value) {
  const v = String(value || '').trim();
  if (!v) return { ok: false, message: '请输入邮箱' };
  if (!EMAIL_REGEX.test(v)) return { ok: false, message: '邮箱格式不正确' };
  return { ok: true, message: '' };
}

export function validateCode(value, len = 6) {
  const v = String(value || '').trim();
  if (!v) return { ok: false, message: '请输入验证码' };
  if (!/^\d+$/.test(v)) return { ok: false, message: '验证码应为数字' };
  if (v.length !== len) return { ok: false, message: `验证码应为${len}位` };
  return { ok: true, message: '' };
}

export function toErrorText(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err.detail === 'string') return err.detail;
  try { return JSON.stringify(err); } catch (_) { return '发生错误'; }
}
