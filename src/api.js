// 简易 API 客户端（基于 fetch），支持 JWT 与统一错误解析，可在运行时切换后端地址
// 默认基址：优先 env，再次用当前页面 hostname + :8000，最后回退 localhost
let API_BASE = process.env.VUE_APP_API_BASE
  || (typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://localhost:8000');

class ApiError extends Error {
  constructor(props = {}) {
    const message = props.detail || props.message || '请求失败'
    super(message)
    this.name = 'ApiError'
    try {
      for (const k of Object.keys(props || {})) this[k] = props[k]
    } catch (_) { /* no-op */ }
    if (!this.detail) this.detail = message
  }
}

function isRemember() {
  try { return localStorage.getItem('rememberMe') === '1' } catch { return false }
}

function broadcastAuth(type, extra = {}) {
  try {
    const payload = { type, t: Date.now(), x: Math.random(), ...extra };
    localStorage.setItem('auth_sync', JSON.stringify(payload));
    try { window.dispatchEvent(new CustomEvent('auth:sync', { detail: payload })) } catch (e) { void e }
  } catch (e) { void e }
}

function getStore(preferRemember = undefined) {
  const remember = (typeof preferRemember === 'boolean') ? preferRemember : isRemember()
  return remember ? window.localStorage : window.sessionStorage
}

function getOtherStore(preferRemember = undefined) {
  const remember = (typeof preferRemember === 'boolean') ? preferRemember : isRemember()
  return remember ? window.sessionStorage : window.localStorage
}

function getAccessToken() {
  // Prefer current strategy's store, but fall back to the other if present
  const cur = getStore();
  const other = getOtherStore();
  return (cur.getItem('access') || other.getItem('access') || '');
}

function getRefreshToken() {
  const cur = getStore();
  const other = getOtherStore();
  return (cur.getItem('refresh') || other.getItem('refresh') || '');
}

function setTokens({ access, refresh }, preferRemember = undefined) {
  const store = getStore(preferRemember);
  const other = getOtherStore(preferRemember);
  if (access) store.setItem('access', access);
  if (refresh) store.setItem('refresh', refresh);
  // ensure single source: remove from the other store
  try { other.removeItem('access'); other.removeItem('refresh'); } catch (e) { void e }
  broadcastAuth('tokens_set', { remember: isRemember() })
}

function clearTokens() {
  try { localStorage.removeItem('access'); localStorage.removeItem('refresh'); } catch (e) { void e }
  try { sessionStorage.removeItem('access'); sessionStorage.removeItem('refresh'); } catch (e) { void e }
  broadcastAuth('logout')
}

function migrateTokens(toRemember) {
  const from = toRemember ? sessionStorage : localStorage
  const to = toRemember ? localStorage : sessionStorage
  try {
    const a = from.getItem('access'); const r = from.getItem('refresh');
    if (a) to.setItem('access', a); else to.removeItem('access');
    if (r) to.setItem('refresh', r); else to.removeItem('refresh');
    from.removeItem('access'); from.removeItem('refresh');
  } catch (e) { void e }
  broadcastAuth('migrate', { toRemember })
}

function parseError(res, data) {
  // 期望后端统一错误结构：{ success:false, code, detail, errors }
  const err = { status: res?.status || 0, code: 'error', detail: '请求失败', errors: null };
  const ct = (res && res.headers && typeof res.headers.get === 'function') ? (res.headers.get('Content-Type') || '') : '';
  const isHtml = ct.includes('text/html');
  if (data && typeof data === 'object' && !isHtml) {
    err.code = data.code || err.code;
    err.detail = data.detail || err.detail;
    err.errors = data.errors ?? data;
    for (const k in data) { if (!(k in err)) err[k] = data[k]; }
  } else {
    // 非 JSON 响应（如 Django 默认 404 HTML），给出友好消息
    const mapping = {
      400: '请求不合法',
      401: '未登录或凭证无效',
      403: '无权限执行该操作',
      404: '资源不存在',
      429: '请求过于频繁',
      500: '服务器错误',
    };
    err.detail = mapping[err.status] || err.detail;
    err.errors = null;
  }
  // 兜底：若 detail 含 HTML 标记，做简单清洗避免在 UI 渲染标签
  if (typeof err.detail === 'string' && /<\/?[a-z][^>]*>/i.test(err.detail)) {
    err.detail = (err.status === 404 ? '资源不存在' : '请求失败');
  }
  return err;
}

async function request(path, { method = 'GET', headers = {}, body = null, auth = true, isForm = false } = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const h = new Headers(headers);
  if (auth) {
    const token = getAccessToken();
    if (token) h.set('Authorization', `Bearer ${token}`);
  }
  if (!isForm) {
    h.set('Content-Type', 'application/json');
  }
  // 让后端根据语言渲染邮件模板
  if (!h.has('Accept-Language') && typeof navigator !== 'undefined') {
    h.set('Accept-Language', navigator.language || 'zh-CN');
  }
  const init = { method, headers: h };
  if (body) init.body = isForm ? body : JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new ApiError({ status: 0, code: 'network_error', detail: '网络异常或服务器不可达', errors: String(e) });
  }

  const contentType = res.headers.get('Content-Type') || '';
  const isJSON = contentType.includes('application/json');
  let data = isJSON ? await res.json() : await res.text();

  // Auto refresh logic on 401 for authenticated requests
  if (auth && res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // retry once with new access token
      const retryHeaders = new Headers(headers);
      const newToken = getAccessToken();
      if (newToken) retryHeaders.set('Authorization', `Bearer ${newToken}`);
      if (!isForm) retryHeaders.set('Content-Type', 'application/json');
      if (!retryHeaders.has('Accept-Language') && typeof navigator !== 'undefined') {
        retryHeaders.set('Accept-Language', navigator.language || 'zh-CN');
      }
      const retryInit = { method, headers: retryHeaders };
      if (body) retryInit.body = isForm ? body : JSON.stringify(body);
      let res2;
      try { res2 = await fetch(url, retryInit) } catch (e) {
        throw new ApiError({ status: 0, code: 'network_error', detail: '网络异常或服务器不可达', errors: String(e) });
      }
      const ct2 = res2.headers.get('Content-Type') || '';
      const json2 = ct2.includes('application/json');
      const data2 = json2 ? await res2.json() : await res2.text();
      if (!res2.ok) {
        const perr = parseError(res2, json2 ? data2 : { detail: data2 });
        throw new ApiError(perr);
      }
      return data2;
    }
  }

  if (!res.ok) {
    const perr = parseError(res, isJSON ? data : { detail: data });
    throw new ApiError(perr);
  }
  return data;
}

async function tryRefresh() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  let res;
  try {
    res = await fetch(`${API_BASE}/api/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
  } catch (e) { return false }
  const ok = res && res.ok;
  const ct = res?.headers?.get('Content-Type') || '';
  const isJSON = ct.includes('application/json');
  const data = isJSON ? await res.json() : await res.text();
  if (!ok) {
    clearTokens();
    return false;
  }
  // some backends return {access, refresh?}
  setTokens({ access: data.access, refresh: data.refresh || refresh });
  return true;
}

export const api = {
  getBase() { return API_BASE },
  setBase(base) { if (typeof base === 'string' && base) API_BASE = base.replace(/\/$/, ''); },
  getAccessToken,
  setTokens,
  clearTokens,
  migrateTokens,
  isRemember,
  // Auth
  async register({ username, email, password, captcha = '' }) {
    return request('/api/users/register/', { method: 'POST', body: { username, email, password, captcha }, auth: false });
  },
  async searchVideos({ page = 1, pageSize = 12, q = '', order = '' } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    if (q) params.set('q', q);
    if (order) params.set('order', order);
    const qp = params.toString();
    const data = await request(`/api/videos/list/${qp ? `?${qp}` : ''}`, { auth: false });
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({
        id: v.id,
        cover: v.thumbnail_url || '',
        title: v.title || '',
        views: v.view_count ?? null,
        likes: v.like_count ?? null,
        favorites: v.favorite_count ?? 0,
        comments: v.comment_count ?? 0,
        author: v.author || null,
        publishedAt: v.published_at || v.created_at || null,
        liked: Boolean(v.liked ?? false),
        favorited: Boolean(v.favorited ?? false),
        src: (v.hls_master_url || v.video_url || ''),
        thumbVtt: v.thumbnail_vtt_url || null,
      })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
  async featuredFeed({ page = 1, pageSize = 12 } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    const qp = params.toString();
    const data = await request(`/api/recommendation/featured/${qp ? `?${qp}` : ''}`, { auth: false });
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({
        id: v.id,
        cover: v.thumbnail_url || '',
        title: v.title || '',
        views: v.view_count ?? null,
        likes: v.like_count ?? null,
        favorites: v.favorite_count ?? 0,
        comments: v.comment_count ?? 0,
        author: v.author || null,
        publishedAt: v.published_at || v.created_at || null,
        liked: Boolean(v.liked ?? false),
        favorited: Boolean(v.favorited ?? false),
        src: (v.hls_master_url || v.video_url || ''),
        thumbVtt: v.thumbnail_vtt_url || null,
      })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
  async followingFeed({ page = 1, pageSize = 12 } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    const qp = params.toString();
    const data = await request(`/api/recommendation/following/${qp ? `?${qp}` : ''}`, { auth: true });
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({
        id: v.id,
        cover: v.thumbnail_url || '',
        title: v.title || '',
        views: v.view_count ?? null,
        likes: v.like_count ?? null,
        favorites: v.favorite_count ?? 0,
        comments: v.comment_count ?? 0,
        author: v.author || null,
        publishedAt: v.published_at || v.created_at || null,
        liked: Boolean(v.liked ?? false),
        favorited: Boolean(v.favorited ?? false),
        src: (v.hls_master_url || v.video_url || ''),
        thumbVtt: v.thumbnail_vtt_url || null,
      })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
  async videoDetail(id) {
    if (!id) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少视频ID' })
    // Public detail: backend allows anonymous; using auth: false avoids 401 during HLS fallback
    return request(`/api/videos/${encodeURIComponent(id)}/`, { auth: false })
  },
  async videoUpdate(id, partial = {}) {
    if (!id) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少视频ID' })
    const body = {}
    if (typeof partial.title === 'string') body.title = partial.title
    if (typeof partial.description === 'string') body.description = partial.description
    return request(`/api/videos/${encodeURIComponent(id)}/`, { method: 'PATCH', body, auth: true })
  },
  async userDetail(id) {
    if (!id) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少用户ID' })
    return request(`/api/users/${encodeURIComponent(id)}/`, { auth: false })
  },
  async analyticsEvents(payload) {
    const body = Array.isArray(payload) ? payload : (payload && typeof payload === 'object' ? payload : {})
    return request('/api/analytics/events/', { method: 'POST', body, auth: false })
  },
  // Interactions lists for "我的"页面
  async likesList({ page = 1, pageSize = 12, userId = '' } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    if (userId) params.set('user_id', userId);
    const qp = params.toString();
    const data = await request(`/api/interactions/likes/${qp ? `?${qp}` : ''}`);
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({ id: v.id, cover: v.cover, title: v.title, views: v.views, likes: v.likes })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
  async favoritesList({ page = 1, pageSize = 12, userId = '' } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    if (userId) params.set('user_id', userId);
    const qp = params.toString();
    const data = await request(`/api/interactions/favorites/${qp ? `?${qp}` : ''}`);
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({ id: v.id, cover: v.cover, title: v.title, views: v.views, likes: v.likes })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
  async watchLaterList({ page = 1, pageSize = 12, userId = '' } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    if (userId) params.set('user_id', userId);
    const qp = params.toString();
    const data = await request(`/api/interactions/watch-later/${qp ? `?${qp}` : ''}`);
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({ id: v.id, cover: v.cover, title: v.title, views: v.views, likes: v.likes })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
  async historyList({ page = 1, pageSize = 12, userId = '' } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    if (userId) params.set('user_id', userId);
    const qp = params.toString();
    const data = await request(`/api/interactions/history/${qp ? `?${qp}` : ''}`);
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({ id: v.id, cover: v.cover, title: v.title, views: v.views, likes: v.likes })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
  // Bulk operations
  async bulkUnlike(videoIds = []) {
    return request('/api/interactions/likes/bulk-unlike/', { method: 'POST', body: { video_ids: videoIds } });
  },
  async bulkFavoritesRemove(videoIds = []) {
    return request('/api/interactions/favorites/bulk-remove/', { method: 'POST', body: { video_ids: videoIds } });
  },
  async bulkWatchLaterRemove(videoIds = []) {
    return request('/api/interactions/watch-later/bulk-remove/', { method: 'POST', body: { video_ids: videoIds } });
  },
  async bulkHistoryRemove(videoIds = []) {
    return request('/api/interactions/history/bulk-remove/', { method: 'POST', body: { video_ids: videoIds } });
  },
  async videosBulkDelete(videoIds = []) {
    return request('/api/videos/bulk-delete/', { method: 'POST', body: { video_ids: videoIds } });
  },
  async sendLoginCode(email) {
    return request('/api/users/login/send-code/', { method: 'POST', body: { email }, auth: false });
  },
  async loginWithCode(email, code) {
    const data = await request('/api/users/login/with-code/', { method: 'POST', body: { email, code }, auth: false });
    setTokens(data);
    return data;
  },
  async login(username, password) {
    const data = await request('/api/token/', { method: 'POST', body: { username, password }, auth: false });
    setTokens(data);
    return data;
  },
  async me() {
    return request('/api/users/me/');
  },
  async updateMe(partial) {
    return request('/api/users/me/', { method: 'PATCH', body: partial });
  },
  async userByUsername(username) {
    return request(`/api/users/by-username/${encodeURIComponent(username)}/`, { auth: false });
  },
  async searchUsers(q) {
    const qp = q ? `?q=${encodeURIComponent(q)}` : '';
    return request(`/api/users/search/${qp}`);
  },
  async sendVerifyEmail() {
    return request('/api/users/verify-email/request/', { method: 'POST' });
  },
  async contactSubmit({ type, name, email, subject, message }) {
    return request('/api/users/contact/submit/', { method: 'POST', body: { type, name, email, subject, message }, auth: false });
  },
  async passwordResetRequest(email) {
    return request('/api/users/password-reset/request/', { method: 'POST', body: { email }, auth: false });
  },
  async avatarUpload(file, crop) {
    const form = new FormData();
    form.append('file', file);
    if (crop) {
      const { x, y, w, h } = crop;
      if ([x, y, w, h].every(v => Number.isFinite(v))) {
        form.append('x', String(Math.floor(x)));
        form.append('y', String(Math.floor(y)));
        form.append('w', String(Math.floor(w)));
        form.append('h', String(Math.floor(h)));
      }
    }
    return request('/api/users/avatar/upload/', { method: 'POST', body: form, isForm: true });
  },
  async videosUpload(file, { title = '', description = '' } = {}) {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    if (description) form.append('description', description);
    return request('/api/videos/upload/', { method: 'POST', body: form, isForm: true });
  },
  async videosUploadWithProgress(file, { title = '', description = '', onProgress = null } = {}) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/api/videos/upload/`);
        const token = getAccessToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.onload = () => {
          try {
            const ok = xhr.status >= 200 && xhr.status < 300;
            const data = JSON.parse(xhr.responseText || '{}');
            if (ok) resolve(data); else reject(new ApiError(parseError({ status: xhr.status, headers: new Headers({ 'Content-Type': 'application/json' }) }, data)));
          } catch (e) { reject(new ApiError({ status: xhr.status, detail: '解析响应失败' })) }
        };
        xhr.onerror = () => reject(new ApiError({ status: 0, code: 'network_error', detail: '网络异常或服务器不可达' }));
        if (xhr.upload && typeof onProgress === 'function') {
          xhr.upload.onprogress = (e) => { if (e && e.lengthComputable) onProgress({ loaded: e.loaded, total: e.total, percent: (e.loaded / e.total) * 100 }) };
        }
        const form = new FormData();
        form.append('file', file);
        if (title) form.append('title', title);
        if (description) form.append('description', description);
        xhr.send(form);
      } catch (e) { reject(new ApiError({ status: 0, code: 'client_error', detail: String(e) })) }
    })
  },
  async uploadInit({ filename, filesize }) {
    return request('/api/videos/upload/init/', { method: 'POST', body: { filename, filesize } });
  },
  async uploadChunk({ uploadId, index, blob }, onProgress = null) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/api/videos/upload/chunk/`);
        const token = getAccessToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.onload = () => {
          try {
            const ok = xhr.status >= 200 && xhr.status < 300;
            const data = JSON.parse(xhr.responseText || '{}');
            if (ok) resolve(data); else reject(new ApiError(parseError({ status: xhr.status, headers: new Headers({ 'Content-Type': 'application/json' }) }, data)));
          } catch (e) { reject(new ApiError({ status: xhr.status, detail: '解析响应失败' })) }
        };
        xhr.onerror = () => reject(new ApiError({ status: 0, code: 'network_error', detail: '网络异常或服务器不可达' }));
        if (xhr.upload && typeof onProgress === 'function') {
          xhr.upload.onprogress = (e) => { if (e && e.lengthComputable) onProgress({ loaded: e.loaded, total: e.total, percent: (e.loaded / e.total) * 100, index }) };
        }
        const form = new FormData();
        form.append('upload_id', uploadId);
        form.append('index', String(index));
        form.append('chunk', blob, `chunk_${index}`);
        xhr.send(form);
      } catch (e) { reject(new ApiError({ status: 0, code: 'client_error', detail: String(e) })) }
    })
  },
  async uploadStatus(uploadId) {
    const qp = `?id=${encodeURIComponent(uploadId)}`;
    return request(`/api/videos/upload/status/${qp}`);
  },
  async uploadComplete({ uploadId, title = '', description = '' }) {
    return request('/api/videos/upload/complete/', { method: 'POST', body: { upload_id: uploadId, title, description } });
  },
  async uploadSmart(file, { title = '', description = '', onProgress = null } = {}) {
    const threshold = 8 * 1024 * 1024;
    if (!file || !(file instanceof Blob)) throw new ApiError({ status: 400, detail: '无效文件' })
    if (file.size <= threshold) return this.videosUploadWithProgress(file, { title, description, onProgress });
    let init;
    try {
      init = await this.uploadInit({ filename: file.name || 'video', filesize: file.size });
    } catch (e) {
      // 后端若尚未支持分片端点，回退直传
      if (Number(e?.status) === 404) {
        return this.videosUploadWithProgress(file, { title, description, onProgress });
      }
      throw e;
    }
    const size = Number(init?.chunk_size || (5 * 1024 * 1024));
    const total = Math.ceil(file.size / size);
    let sent = 0; const started = Date.now();
    for (let i = 0; i < total; i++) {
      const blob = file.slice(i * size, Math.min((i + 1) * size, file.size));
      await this.uploadChunk({ uploadId: init.upload_id, index: i, blob }, (e) => {
        if (!onProgress) return;
        sent += e.loaded;
        const elapsed = (Date.now() - started) / 1000;
        const speed = sent / Math.max(1, elapsed);
        const remain = Math.max(0, file.size - sent);
        const eta = speed > 0 ? remain / speed : 0;
        onProgress({ loaded: sent, total: file.size, percent: (sent / file.size) * 100, speed, eta, index: i });
      });
    }
    return this.uploadComplete({ uploadId: init.upload_id, title, description });
  },
  async requestLikeToggle(videoId) {
    return request('/api/interactions/like/toggle/', { method: 'POST', body: { video_id: videoId } });
  },
  async requestFavoriteToggle(videoId) {
    return request('/api/interactions/favorite/toggle/', { method: 'POST', body: { video_id: videoId } });
  },
  async historyRecord({ videoId, current = null, duration = null, progress = null, watchDuration = null } = {}) {
    const body = { video_id: videoId };
    if (current !== null && current !== undefined) body.current = current;
    if (duration !== null && duration !== undefined) body.duration = duration;
    if (progress !== null && progress !== undefined) body.progress = progress;
    if (watchDuration !== null && watchDuration !== undefined) body.watch_duration = watchDuration;
    return request('/api/interactions/history/record/', { method: 'POST', body });
  },
  // Follow APIs
  async follow(userId) {
    return request('/api/interactions/follow/', { method: 'POST', body: { user_id: userId } });
  },
  async unfollow(userId) {
    return request('/api/interactions/unfollow/', { method: 'POST', body: { user_id: userId } });
  },
  async followers(userId = null) {
    const qp = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    return request(`/api/interactions/followers/${qp}`);
  },
  async following(userId = null) {
    const qp = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    return request(`/api/interactions/following/${qp}`);
  },
  // Flexible query variants with pagination and search
  async followersQuery({ userId = null, page = 1, q = '', order = '' } = {}) {
    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (page && Number(page) > 1) params.set('page', String(page));
    if (q) params.set('q', q);
    if (order) params.set('order', order);
    const qp = params.toString();
    return request(`/api/interactions/followers/${qp ? `?${qp}` : ''}`);
  },
  async followingQuery({ userId = null, page = 1, q = '', order = '' } = {}) {
    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (page && Number(page) > 1) params.set('page', String(page));
    if (q) params.set('q', q);
    if (order) params.set('order', order);
    const qp = params.toString();
    return request(`/api/interactions/following/${qp ? `?${qp}` : ''}`);
  },
  // QR login
  async qrCreate() {
    return request('/api/users/login/qr/create/', { method: 'POST', body: {}, auth: false });
  },
  async qrStatus(session) {
    const qp = `?session=${encodeURIComponent(session)}`;
    return request(`/api/users/login/qr/status/${qp}`, { auth: false });
  },
  // Popup stats for avatar hover
  async popupStats(force = false) {
    const qp = force ? '?force=1' : '';
    return request(`/api/users/popup/stats/${qp}`);
  },
  async relationship(userId) {
    if (!userId) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少用户ID' })
    const qp = `?user_id=${encodeURIComponent(userId)}`
    return request(`/api/interactions/relationship/${qp}`, { auth: true })
  },
  // Comments
  async commentsList({ videoId, page = 1, pageSize = 10 } = {}) {
    if (!videoId) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少视频ID' })
    const params = new URLSearchParams();
    params.set('video_id', videoId)
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    const qp = params.toString();
    return request(`/api/interactions/comments/${qp ? `?${qp}` : ''}`, { auth: false })
  },
  async commentsReplies({ parentId, page = 1, pageSize = 10 } = {}) {
    if (!parentId) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少父评论ID' })
    const params = new URLSearchParams();
    params.set('parent_id', parentId)
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    const qp = params.toString();
    return request(`/api/interactions/comments/replies/${qp ? `?${qp}` : ''}`, { auth: false })
  },
  async commentCreate({ videoId, content, parentId = null } = {}) {
    if (!videoId) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少视频ID' })
    const body = { video_id: videoId, content: content || '' }
    if (parentId) body.parent_id = parentId
    return request('/api/interactions/comments/', { method: 'POST', body, auth: true })
  },
  async commentDelete(id) {
    if (!id) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少评论ID' })
    return request(`/api/interactions/comments/${encodeURIComponent(id)}/`, { method: 'DELETE', auth: true })
  },
  // Notifications
  async notificationsList({ page = 1, pageSize = 20, unread = false } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    if (unread) params.set('unread', '1');
    const qp = params.toString();
    return request(`/api/notifications/${qp ? `?${qp}` : ''}`)
  },
  async notificationsUnreadCount() {
    return request('/api/notifications/unread-count/')
  },
  async notificationsMarkRead(ids = []) {
    return request('/api/notifications/mark-read/', { method: 'POST', body: { ids } })
  },
  async notificationsMarkAllRead() {
    return request('/api/notifications/mark-all-read/', { method: 'POST', body: {} })
  },
  async notificationsClear() {
    return request('/api/notifications/clear/', { method: 'POST', body: {} })
  },
  // Videos list (public feed) - used for "我的/推荐"标签
  async videosList({ page = 1, pageSize = 12, userId = '', order = '', q = '' } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    if (userId) params.set('user_id', userId);
    if (order) params.set('order', order);
    if (q) params.set('q', q);
    const qp = params.toString();
    const data = await request(`/api/videos/list/${qp ? `?${qp}` : ''}`, { auth: true });
    // backend shape: { results: [{thumbnail_url,title,view_count}], page, total, has_next }
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({
        id: v.id,
        cover: v.thumbnail_url || '',
        title: v.title || '',
        views: v.view_count ?? null,
        likes: v.like_count ?? null,
        favorites: v.favorite_count ?? 0,
        comments: v.comment_count ?? 0,
        author: v.author || null,
        publishedAt: v.published_at || v.created_at || null,
        liked: Boolean(v.liked ?? false),
        favorited: Boolean(v.favorited ?? false),
        src: (v.hls_master_url || v.video_url || ''),
        thumbVtt: v.thumbnail_vtt_url || null,
      })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
  async recommendationFeed({ page = 1, pageSize = 12 } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    const qp = params.toString();
    const data = await request(`/api/recommendation/feed/${qp ? `?${qp}` : ''}`, { auth: false });
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({
        id: v.id,
        cover: v.thumbnail_url || '',
        title: v.title || '',
        views: v.view_count ?? null,
        likes: v.like_count ?? null,
        favorites: v.favorite_count ?? 0,
        comments: v.comment_count ?? 0,
        author: v.author || null,
        publishedAt: v.published_at || v.created_at || null,
        liked: Boolean(v.liked ?? false),
        favorited: Boolean(v.favorited ?? false),
        src: (v.hls_master_url || v.video_url || ''),
        thumbVtt: v.thumbnail_vtt_url || null,
      })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
};
