// 简易 API 客户端（基于 fetch），支持 JWT 与统一错误解析，可在运行时切换后端地址
// 默认基址：
// - 优先 VUE_APP_API_BASE
// - 否则将 web/admin/mobile.* 自动映射为 api.*
// - 端口：如果页面是 dev server 端口（如 8080/8082/5173），API 走 :8000；如果是 80/无端口，则不显式拼接端口
function resolveApiBase() {
  const fromEnv = process.env.VUE_APP_API_BASE;
  if (fromEnv && typeof fromEnv === 'string') return fromEnv.replace(/\/$/, '');
  try {
    if (typeof window === 'undefined' || !window.location) return 'http://localhost:8000';
    const proto = window.location.protocol || 'http:';
    const host = window.location.hostname || '127.0.0.1';
    const apiHost = host.replace(/^(admin|web|mobile)\./, 'api.');
    const port = window.location.port || '';
    const isDefaultPort = !port || port === '80' || port === '443';
    // 若当前页面是 dev server 端口（如 8080/8082/5173），后端通常在 8000
    const apiPort = isDefaultPort ? '' : ':8000';
    return `${proto}//${apiHost}${apiPort}`.replace(/\/$/, '');
  } catch (_) {
    return 'http://localhost:8000';
  }
}

let API_BASE = resolveApiBase();

function withApiBaseMaybe(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) {
    try {
      const proto = (typeof window !== 'undefined' && window.location && window.location.protocol) ? window.location.protocol : 'http:';
      return `${proto}${s}`;
    } catch (_) {
      return `http:${s}`;
    }
  }
  // Media paths returned by backend may be relative (e.g. /media/...). In that case, prefix current API base.
  if (s.startsWith('/media/') || s.startsWith('media/')) {
    const rel = s.startsWith('/') ? s : `/${s}`;
    return `${API_BASE}${rel}`;
  }
  return s;
}

// 请求去重与 429 退避控制
const pendingRequests = new Map();
const rateLimitState = new Map();
let globalInFlight = 0;
const MAX_CONCURRENT = 1000; // 禁用并发限制
const MAX_429_RETRIES = 0; // 禁用 429 重试
const BASE_429_DELAY = 0;

function getRequestKey(url, method, body) {
  const bodyKey = body ? JSON.stringify(body) : '';
  return `${method}::${url}::${bodyKey}`;
}

function isRateLimited(key) {
  const state = rateLimitState.get(key);
  if (!state) return false;
  return Date.now() < state.retryAfter;
}

function get429Delay(attempt) {
  const jitter = Math.floor(Math.random() * 500);
  return BASE_429_DELAY * Math.pow(2, attempt) + jitter;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForSlot() {
  while (globalInFlight >= MAX_CONCURRENT) {
    await sleep(100);
  }
  globalInFlight++;
}

function releaseSlot() {
  globalInFlight = Math.max(0, globalInFlight - 1);
}

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

async function request(path, { method = 'GET', headers = {}, body = null, auth = true, isForm = false, attempt = 0 } = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const key = getRequestKey(url, method, body);

  // 请求去重：如果相同的请求正在进行中，返回该 Promise
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending;
  }

  // 检查是否处于 429 退避期
  if (isRateLimited(key) && attempt === 0) {
    const state = rateLimitState.get(key);
    const waitMs = state ? Math.max(0, state.retryAfter - Date.now()) : BASE_429_DELAY;
    await sleep(waitMs);
  }

  const promise = (async () => {
    // 等待并发槽位
    await waitForSlot();
    
    const h = new Headers(headers);
    if (auth) {
      const token = getAccessToken();
      if (token) h.set('Authorization', `Bearer ${token}`);
    }
    if (!isForm) {
      h.set('Content-Type', 'application/json');
    }
    if (!h.has('Accept-Language') && typeof navigator !== 'undefined') {
      h.set('Accept-Language', navigator.language || 'zh-CN');
    }
    const init = { method, headers: h };
    if (body) init.body = isForm ? body : JSON.stringify(body);

    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      pendingRequests.delete(key);
      releaseSlot();
      throw new ApiError({ status: 0, code: 'network_error', detail: '网络异常或服务器不可达', errors: String(e) });
    }

    // 处理 429 速率限制
    if (res.status === 429) {
      if (attempt < MAX_429_RETRIES) {
        const delay = get429Delay(attempt);
        rateLimitState.set(key, { retryAfter: Date.now() + delay, attempt: attempt + 1 });
        await sleep(delay);
        pendingRequests.delete(key);
        releaseSlot();
        return request(path, { method, headers, body, auth, isForm, attempt: attempt + 1 });
      }
    }

    const contentType = res.headers.get('Content-Type') || '';
    const isJSON = contentType.includes('application/json');
    let data = isJSON ? await res.json() : await res.text();

    // Auto refresh logic on 401 for authenticated requests
    if (auth && res.status === 401) {
      const refreshed = await tryRefresh();
      if (refreshed) {
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
          pendingRequests.delete(key);
          releaseSlot();
          throw new ApiError({ status: 0, code: 'network_error', detail: '网络异常或服务器不可达', errors: String(e) });
        }
        const ct2 = res2.headers.get('Content-Type') || '';
        const json2 = ct2.includes('application/json');
        const data2 = json2 ? await res2.json() : await res2.text();
        if (!res2.ok) {
          pendingRequests.delete(key);
          releaseSlot();
          const perr = parseError(res2, json2 ? data2 : { detail: data2 });
          throw new ApiError(perr);
        }
        pendingRequests.delete(key);
        releaseSlot();
        return data2;
      }
    }

    if (!res.ok) {
      pendingRequests.delete(key);
      releaseSlot();
      const perr = parseError(res, isJSON ? data : { detail: data });
      throw new ApiError(perr);
    }
    pendingRequests.delete(key);
    releaseSlot();
    return data;
  })();

  pendingRequests.set(key, promise);
  return promise;
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
  // Content: tags & categories (public)
  async contentTags({ q = '', page = 1, pageSize = 20 } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    const qp = params.toString();
    try {
      return await request(`/api/content/tags/${qp ? `?${qp}` : ''}`, { auth: false });
    } catch (e) {
      if (e && e.status === 404) {
        return { results: [], page: Number(page || 1), page_size: Number(pageSize || 20), total: 0, has_next: false };
      }
      throw e;
    }
  },
  async contentCategories({ q = '', page = 1, pageSize = 50 } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    const qp = params.toString();
    try {
      return await request(`/api/content/categories/${qp ? `?${qp}` : ''}`, { auth: false });
    } catch (e) {
      if (e && e.status === 404) {
        return { results: [], page: Number(page || 1), page_size: Number(pageSize || 50), total: 0, has_next: false };
      }
      throw e;
    }
  },
  async contentTagCreate(name) {
    const body = { name: String(name || '') };
    try {
      return await request('/api/content/tags/', { method: 'POST', body });
    } catch (e) {
      if (e && e.status === 404) {
        throw new ApiError({ status: 404, detail: '后端未开启标签创建接口，请稍后再试' });
      }
      throw e;
    }
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
        cover: withApiBaseMaybe(v.thumbnail_url) || '',
        title: v.title || '',
        views: v.view_count ?? null,
        likes: v.like_count ?? null,
        favorites: v.favorite_count ?? 0,
        comments: v.comment_count ?? 0,
        author: v.author || null,
        publishedAt: v.published_at || v.created_at || null,
        liked: Boolean(v.liked ?? false),
        favorited: Boolean(v.favorited ?? false),
        src: withApiBaseMaybe(v.hls_master_url || v.video_url) || '',
        thumbVtt: withApiBaseMaybe(v.thumbnail_vtt_url) || null,
        category: v.category || null,
        tags: Array.isArray(v.tags) ? v.tags : [],
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
        cover: withApiBaseMaybe(v.thumbnail_url) || '',
        title: v.title || '',
        views: v.view_count ?? null,
        likes: v.like_count ?? null,
        favorites: v.favorite_count ?? 0,
        comments: v.comment_count ?? 0,
        author: v.author || null,
        publishedAt: v.published_at || v.created_at || null,
        liked: Boolean(v.liked ?? false),
        favorited: Boolean(v.favorited ?? false),
        src: withApiBaseMaybe(v.hls_master_url || v.video_url) || '',
        thumbVtt: withApiBaseMaybe(v.thumbnail_vtt_url) || null,
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
        cover: withApiBaseMaybe(v.thumbnail_url) || '',
        title: v.title || '',
        views: v.view_count ?? null,
        likes: v.like_count ?? null,
        favorites: v.favorite_count ?? 0,
        comments: v.comment_count ?? 0,
        author: v.author || null,
        publishedAt: v.published_at || v.created_at || null,
        liked: Boolean(v.liked ?? false),
        favorited: Boolean(v.favorited ?? false),
        src: withApiBaseMaybe(v.hls_master_url || v.video_url) || '',
        thumbVtt: withApiBaseMaybe(v.thumbnail_vtt_url) || null,
      })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
  async videoDetail(id) {
    if (!id) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少视频ID' })
    // Use auth=true so owners can access private videos; anonymous requests still work when no token
    const v = await request(`/api/videos/${encodeURIComponent(id)}/`, { auth: true })
    try {
      if (v && typeof v === 'object') {
        if ('thumbnail_url' in v) v.thumbnail_url = withApiBaseMaybe(v.thumbnail_url)
        if ('thumbnail_vtt_url' in v) v.thumbnail_vtt_url = withApiBaseMaybe(v.thumbnail_vtt_url)
        if ('video_url' in v) v.video_url = withApiBaseMaybe(v.video_url)
        if ('hls_master_url' in v) v.hls_master_url = withApiBaseMaybe(v.hls_master_url)
        if ('low_mp4_url' in v) v.low_mp4_url = withApiBaseMaybe(v.low_mp4_url)
      }
    } catch (_) { /* no-op */ }
    return v
  },
  async videoUpdate(id, partial = {}) {
    if (!id) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少视频ID' })
    const body = {}
    if (typeof partial.title === 'string') body.title = partial.title
    if (typeof partial.description === 'string') body.description = partial.description
    if (Object.prototype.hasOwnProperty.call(partial, 'allow_comments')) body.allow_comments = !!partial.allow_comments
    if (Object.prototype.hasOwnProperty.call(partial, 'allow_download')) body.allow_download = !!partial.allow_download
    if (typeof partial.visibility === 'string' && ['public','unlisted','private'].includes(partial.visibility)) body.visibility = partial.visibility
    if (Object.prototype.hasOwnProperty.call(partial, 'category_id')) body.category_id = (partial.category_id == null ? '' : String(partial.category_id))
    if (Array.isArray(partial.tag_ids)) body.tag_ids = partial.tag_ids.map(String)
    return request(`/api/videos/${encodeURIComponent(id)}/`, { method: 'PATCH', body, auth: true })
  },
  async videoThumbnailPick(id, ts = 1) {
    if (!id) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少视频ID' })
    return request(`/api/videos/${encodeURIComponent(id)}/thumbnail/pick/`, { method: 'POST', body: { ts: Number(ts) || 1 }, auth: true })
  },
  async videoThumbnailUpload(id, file) {
    if (!id) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少视频ID' })
    if (!file) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少文件' })
    const form = new FormData();
    form.append('file', file);
    return request(`/api/videos/${encodeURIComponent(id)}/thumbnail/upload/`, { method: 'POST', body: form, isForm: true, auth: true })
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
  async favorites({ page = 1, pageSize = 12, userId = '' } = {}) {
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
  async favoritesList({ page = 1, pageSize = 12, userId = '' } = {}) {
    return this.favorites({ page, pageSize, userId });
  },
  async retryTranscode(videoId) {
    return request(`/api/videos/${videoId}/retry-transcode/`, { method: 'POST' });
  },
  async watchLaterToggle(videoId) {
    return request('/api/interactions/watch-later/toggle/', { method: 'POST', body: { video_id: videoId } });
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
  async videosBulkUpdate(videoIds = [], partial = {}) {
    const body = { video_ids: Array.isArray(videoIds) ? videoIds : [] };
    // only include known fields if provided
    if (Object.prototype.hasOwnProperty.call(partial, 'allow_comments')) body.allow_comments = !!partial.allow_comments;
    if (Object.prototype.hasOwnProperty.call(partial, 'allow_download')) body.allow_download = !!partial.allow_download;
    if (typeof partial.visibility === 'string' && ['public','unlisted','private'].includes(partial.visibility)) body.visibility = partial.visibility;
    return request('/api/videos/bulk-update/', { method: 'POST', body });
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
  async emailChangeRequest(newEmail) {
    return request('/api/users/email/change/request/', { method: 'POST', body: { new_email: newEmail } });
  },
  async emailChangeConfirm(token) {
    return request('/api/users/email/change/confirm/', { method: 'POST', body: { token }, auth: false });
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
      const sendOnce = async (retried = false) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE}/api/videos/upload/`);
          const token = getAccessToken();
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.onload = async () => {
            const status = xhr.status;
            let data = {};
            try { data = JSON.parse(xhr.responseText || '{}') } catch { /* no-op */ }
            if (status >= 200 && status < 300) { resolve(data); return }
            if (status === 401 && !retried) {
              const ok = await tryRefresh();
              if (ok) { sendOnce(true); return }
            }
            reject(new ApiError(parseError({ status, headers: new Headers({ 'Content-Type': 'application/json' }) }, data)));
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
      };
      sendOnce(false);
    })
  },
  async uploadInit({ filename, filesize }) {
    return request('/api/videos/upload/init/', { method: 'POST', body: { filename, filesize } });
  },
  async uploadChunk({ uploadId, index, blob }, onProgress = null) {
    return new Promise((resolve, reject) => {
      const sendOnce = async (retried = false) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE}/api/videos/upload/chunk/`);
          const token = getAccessToken();
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.onload = async () => {
            const status = xhr.status;
            let data = {};
            try { data = JSON.parse(xhr.responseText || '{}') } catch { /* no-op */ }
            if (status >= 200 && status < 300) { resolve(data); return }
            if (status === 401 && !retried) {
              const ok = await tryRefresh();
              if (ok) { sendOnce(true); return }
            }
            reject(new ApiError(parseError({ status, headers: new Headers({ 'Content-Type': 'application/json' }) }, data)));
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
      };
      sendOnce(false);
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
  // Global Configs
  async globalConfigs() {
    return request('/api/configs/global/', { auth: false });
  },
  async adminUpdateConfigs(payload) {
    return request('/api/configs/admin/update/', { method: 'POST', body: payload, auth: true });
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

  // System announcements (global system messages)
  async announcementsList({ page = 1, pageSize = 10, includeInactive = false } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    if (includeInactive) params.set('include_inactive', '1');
    const qp = params.toString();
    return request(`/api/notifications/announcements/${qp ? `?${qp}` : ''}`)
  },
  async announcementsUnreadCount() {
    return request('/api/notifications/announcements/unread-count/')
  },
  async announcementsLatestUnread() {
    return request('/api/notifications/announcements/latest-unread/')
  },
  async announcementDetail(id) {
    if (!id) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少公告ID' })
    return request(`/api/notifications/announcements/${encodeURIComponent(id)}/`)
  },
  async announcementMarkRead(id) {
    if (!id) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少公告ID' })
    return request(`/api/notifications/announcements/${encodeURIComponent(id)}/read/`, { method: 'POST', body: {} })
  },
  // Reports (举报)
  async reportCreate({ targetType, targetId, reasonCode = 'other', description = '' } = {}) {
    if (!targetType || !targetId) throw new ApiError({ status: 400, code: 'bad_request', detail: '缺少举报目标类型或ID' })
    const validTypes = ['video', 'comment', 'user']
    if (!validTypes.includes(targetType)) throw new ApiError({ status: 400, code: 'bad_request', detail: '非法的举报类型' })
    return request('/api/interactions/reports/', {
      method: 'POST',
      body: { target_type: targetType, target_id: targetId, reason_code: reasonCode, description },
      auth: true
    })
  },
  // Videos list (public feed) - used for "我的/推荐"标签
  async videosList({ page = 1, pageSize = 12, userId = '', order = '', q = '', categoryId = '', tagIds = [], tagMatch = 'any' } = {}) {
    const params = new URLSearchParams();
    if (page && Number(page) > 1) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));
    if (userId) params.set('user_id', userId);
    if (order) params.set('order', order);
    if (q) params.set('q', q);
    if (categoryId) params.set('category_id', categoryId);
    if (Array.isArray(tagIds) && tagIds.length) {
      params.set('tag_ids', tagIds.map(String).join(','));
      if (tagMatch && (tagMatch === 'all' || tagMatch === 'any')) params.set('tag_match', tagMatch);
    }
    const qp = params.toString();
    const data = await request(`/api/videos/list/${qp ? `?${qp}` : ''}`, { auth: true });
    // backend shape: { results: [{thumbnail_url,title,view_count}], page, total, has_next }
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({
        id: v.id,
        status: v.status || '',
        transcodeError: v.transcode_error || '',
        cover: withApiBaseMaybe(v.thumbnail_url) || '',
        title: v.title || '',
        views: v.view_count ?? null,
        likes: v.like_count ?? null,
        favorites: v.favorite_count ?? 0,
        comments: v.comment_count ?? 0,
        author: v.author || null,
        publishedAt: v.published_at || v.created_at || null,
        lowMp4: withApiBaseMaybe(v.low_mp4_url) || '',
        liked: Boolean(v.liked ?? false),
        favorited: Boolean(v.favorited ?? false),
        src: withApiBaseMaybe(v.hls_master_url || v.video_url) || '',
        thumbVtt: withApiBaseMaybe(v.thumbnail_vtt_url) || null,
        category: v.category || null,
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
    // 使用 auth: true，让后端根据登录态返回个性化字段与结果
    const data = await request(`/api/recommendation/feed/${qp ? `?${qp}` : ''}`, { auth: true });
    return {
      items: Array.isArray(data?.results) ? data.results.map(v => ({
        id: v.id,
        cover: withApiBaseMaybe(v.thumbnail_url) || '',
        title: v.title || '',
        views: v.view_count ?? null,
        likes: v.like_count ?? null,
        favorites: v.favorite_count ?? 0,
        comments: v.comment_count ?? 0,
        author: v.author || null,
        publishedAt: v.published_at || v.created_at || null,
        liked: Boolean(v.liked ?? false),
        favorited: Boolean(v.favorited ?? false),
        src: withApiBaseMaybe(v.hls_master_url || v.video_url) || '',
        thumbVtt: withApiBaseMaybe(v.thumbnail_vtt_url) || null,
      })) : [],
      page: Number(data?.page || page || 1),
      hasNext: Boolean(data?.has_next ?? false),
      total: Number(data?.total || 0),
    };
  },
};
