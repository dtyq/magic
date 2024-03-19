# 弹窗登录技术方案

## 概述

本文档描述基于浏览器弹窗（Popup Window）的 OAuth / SSO 第三方授权登录流程。用户在主窗口选择登录方式后，系统打开一个小型弹窗完成授权，授权结果通过 `BroadcastChannel` 广播回主窗口，主窗口完成最终的 token 换取和登录状态初始化，弹窗随即自动销毁。

**核心设计原则**：

- **popup 只做两件事**：发起 OAuth 跳转 / 将授权结果（`loginTicket` 或 `registerToken`）发回主窗口
- **主窗口负责所有业务逻辑**：token 换取、UI 状态更新、登录流程完成
- **职责边界清晰**：popup 不操作任何 React 状态，主窗口不依赖 URL 参数完成登录
- **popup 是独立子页**：`login-popup-callback.html` 拥有独立入口，零主应用初始化开销

---

## 一、整体流程

```
主窗口（GoogleLogin / AppleLogin）              Popup（login-popup-callback.html）
  │                                                       │
  │─ useEffect([]) 挂载时 ───────────────────────────────►│ PopupCallback 渲染
  │  openPopupLogin(getPopupLoginUrl(...))                 │ useOAuthPopupHandler() 运行
  │                                                       │
  │                                                       │─ 无 provider 参数
  │                                                       │  → 读取 login-strategy
  │                                                       │  → googleAuthorize / appleAuthorize
  │                                                       │  → window.location.href = auth_url
  │                                                       │                    ▼
  │                                                       │           用户在 OAuth 页面授权
  │                                                       │                    ▼
  │                                                       │─ 携带 provider + loginTicket 回跳
  │                                                       │  useOAuthPopupHandler() 再次触发
  │                                                       │─ sendPopupToken({ loginTicket, loginType })
  │                                                       │  BroadcastChannel 广播
  │                                                       │─ setTimeout(window.close, 300ms)
  │                                                       │
  │◄─ eventFactory.on(POPUP_LOGIN) ─────────────────────── ✕ 窗口销毁
  │  loginStore.setLoginTicket(loginTicket)
  │  loginStore.setLoginType(loginType)
  │
  │─ observer 重渲染 → useEffect([loginType, loginTicket]) 触发
  │─ initWhenInMainWindow()
  │  loginStore.resetPopupState()         ← 立即清除，防止重复执行
  │─ LoginApi.exchangeLoginTicket(loginTicket)
  │─ onSubmit(res) → 完成登录，跳转首页
```

---

## 二、通信机制

### 2.1 popup → 主窗口（`BroadcastChannel` 为主）

```
场景判断逻辑（sendPopupToken）:

window !== window.parent
  └─ iframe 模式 → window.parent.postMessage(payload, origin)
                   （BroadcastChannel 无法穿越同 Tab 的 iframe 边界）

window === window.parent
  └─ popup 模式 → BroadcastChannelSender.popupLogin(payload)
                  + setTimeout(window.close, 300ms)
```

**为什么 popup 模式优先 `BroadcastChannel`，而非 `window.opener.postMessage`？**

`window.opener` 在部分浏览器配置（`rel="noopener"`、跨进程渲染）下可能为 `null`，而 `BroadcastChannel` 只要同源就能可靠送达，且天然广播到所有同源 Tab，无需持有父窗口引用。

### 2.2 主窗口接收（`eventFactory`）

```typescript
// src/opensource/broadcastChannel/eventFactory/index.ts
eventFactory.on(EVENTS.POPUP_LOGIN, (data: PopupLoginSuccessData) => {
  loginStore.setLoginType(data.loginType)
  loginStore.setLoginTicket(data.loginTicket ?? null)
  loginStore.setRegisterToken(data.registerToken ?? null)
})
```

`eventFactory` 集中管理所有跨 Tab 事件，与 `LOGOUT`、`SWITCH_ACCOUNT` 等事件保持统一模式。

---

## 三、时序图（以 Google 登录为例）

```
主窗口（GoogleLogin）              Popup（useOAuthPopupHandler）
       │                                         │
       │ 组件挂载                                │
       │─ openPopupLogin(url) ─────────────────►│
       │                                         │ 无 provider 参数
       │                                         │─ googleAuthorize(redirectURL)
       │                                         │─ window.location.href = auth_url
       │                                         │           ▼ 用户授权
       │                                         │  Google 回调携带 provider=google&login_ticket=xxx
       │                                         │─ handleOAuthCallback() 再次执行
       │                                         │─ sendPopupToken({ loginTicket })
       │                                         │─ BroadcastChannel 广播
       │                                         │─ setTimeout(close, 300ms)
       │                                         │
       │◄─ POPUP_LOGIN 事件 ────────────────────── ✕
       │  loginStore.loginTicket = "xxxx"
       │
       │ observer 重渲染
       │─ useEffect([loginType, loginTicket])
       │─ initWhenInMainWindow()
       │─ loginStore.resetPopupState()
       │─ exchangeLoginTicket(loginTicket)
       │─ onSubmit(response)
       │─ 跳转首页 ✓
```

---

## 四、Apple 登录特殊流程

Apple OAuth 有两种返回状态，导致比 Google 多一个分支：

```
Popup（useOAuthPopupHandler → provider=apple）:

  status=bound + login_ticket
    └─ sendPopupToken({ loginTicket, loginType: AppleLogin })
       主窗口 initWhenInMainWindow → exchangeLoginTicket → onSubmit ✓

  status=pending_registration + register_token
    └─ sendPopupToken({ registerToken, loginType: AppleLogin })
       主窗口 initWhenInMainWindow → loginStore.registerToken 更新
       setRegisterToken(storeRegisterToken)
       setStage(CheckPhoneBind)  ← 渲染手机绑定表单
       用户绑定手机后
       LoginApi.verifyRegister → onSubmit ✓

  无相关参数
    └─ window.location.href = appleAuthorize(redirectURL)
```

**关键设计决策**：手机绑定界面始终在主窗口渲染，popup 只传递 `register_token`，不渲染任何业务 UI。

---

## 五、核心模块说明

### 5.1 `login-popup-callback.html` / `main.popup.tsx` — 独立子页入口

**路径**：根目录 `login-popup-callback.html`，入口 `src/main.popup.tsx`

Popup 窗口拥有完全独立的 HTML 入口，与主应用（`index.html` / `main.tsx`）彻底隔离。

```
login-popup-callback.html
  └─ <script src="/config.js">          ← 仅加载 API 配置
  └─ <script type="module" src="/src/main.popup.tsx">

main.popup.tsx
  └─ BrowserRouter                      ← 提供 useLocation 上下文
       └─ PopupCallback                 ← 仅运行 useOAuthPopupHandler
```

**不加载的内容**（对比主应用 `main.tsx`）：

| 主应用初始化 | popup 子页 |
|---|---|
| `appService.init()`（鉴权、WebSocket） | ❌ 不加载 |
| `registerPremiumComponents()` | ❌ 不加载 |
| `AppInitProvider`（阻塞骨架屏） | ❌ 不加载 |
| MobX stores、immer、dotlottie WASM | ❌ 不加载 |
| 完整路由树 | ❌ 不加载 |

> **为什么不需要服务端额外配置路由转发？**
> HTML 文件名 `login-popup-callback.html` 与路由路径 `/login-popup-callback` 完全一致，静态服务器的 `try_files $uri $uri.html` 规则即可直接匹配。

### 5.2 `useOAuthPopupHandler` — popup 侧 OAuth 回调统一处理

**路径**：`src/pages/login/PopupCallback/useOAuthPopupHandler.ts`

在 popup 窗口中统一处理所有 OAuth 提供商的回调，替代了原来分散在 `GoogleLogin`、`AppleLogin` 组件中的 `initWhenInPopupWindow` 逻辑。

```typescript
function useOAuthPopupHandler() {
  const location = useLocation()

  const handleOAuthCallback = useMemoizedFn(async () => {
    const searchParams = new URLSearchParams(location.search)
    const provider = searchParams.get("provider")          // OAuth 回调时存在
    const loginStrategy = searchParams.get(DEFAULT_LOGIN_STRATEGY) // 初始加载时存在

    // ── Google OAuth 已回调 ──────────────────────────────────────
    if (provider === "google") {
      const loginTicket = searchParams.get("login_ticket")
      if (loginTicket) sendPopupToken({ loginTicket, loginType: Login.LoginType.GoogleLogin })
      return
    }

    // ── Apple OAuth 已回调 ───────────────────────────────────────
    if (provider === "apple") {
      const status = searchParams.get("status")
      const loginTicket = searchParams.get("login_ticket")
      const registerToken = searchParams.get("register_token")
      if (status === "bound" && loginTicket)
        sendPopupToken({ loginTicket, loginType: Login.LoginType.AppleLogin })
      else if (status === "pending_registration" && registerToken)
        sendPopupToken({ registerToken, loginType: Login.LoginType.AppleLogin })
      return
    }

    // ── 初始加载：发起对应 OAuth 跳转 ────────────────────────────
    const redirectURL = `${window.location.origin}${RoutePath.LoginPopupCallback}`
    if (loginStrategy === Login.LoginType.GoogleLogin) {
      const res = await LoginApi.googleAuthorize(redirectURL)
      window.location.href = res.authorization_url
    } else if (loginStrategy === Login.LoginType.AppleLogin) {
      const res = await LoginApi.appleAuthorize(redirectURL)
      window.location.href = res.authorization_url
    }
  })

  useEffect(() => {
    handleOAuthCallback().catch((error) => logger.error("oauthPopupCallbackError", error))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])
}
```

**三种执行路径**：

| URL 参数特征 | 执行路径 |
|---|---|
| `?login-strategy=google` | 调用 `googleAuthorize` → 跳转 Google 授权页 |
| `?provider=google&login_ticket=xxx` | `sendPopupToken` → BroadcastChannel → `window.close` |
| `?provider=apple&status=pending_registration&register_token=xxx` | `sendPopupToken(registerToken)` → BroadcastChannel → `window.close` |

### 5.3 `usePopupLogin` — 弹窗生命周期管理

**路径**：`src/pages/login/hooks/usePopupLogin.ts`

职责：窗口尺寸计算、`window.open`、超时兜底（5 分钟）、手动关闭轮询（500ms）、组件卸载时清理定时器。

```typescript
function usePopupLogin() {
  const cleanupRef = useRef<(() => void) | null>(null)

  const openPopupWindow = useMemoizedFn((popupUrl: string) => {
    cleanupRef.current?.()  // 防止重复打开

    // 宽度：视口 40%，夹紧在 [400, 560]px
    // 高度：视口 72%，夹紧在 [520, 760]px
    const width = Math.round(Math.min(Math.max(window.innerWidth * 0.4, 400), 560))
    const height = Math.round(Math.min(Math.max(window.innerHeight * 0.72, 520), 760))

    const popup = window.open(popupUrl, "login_popup", `width=${width},height=${height},...`)
    if (!popup) { /* 弹窗被拦截，logger.error */ return }

    const timeoutTimer = setTimeout(() => { cleanup(); popup.close() }, 5 * 60 * 1000)
    const pollTimer = setInterval(() => { if (popup.closed) cleanup() }, 500)

    function cleanup() {
      clearTimeout(timeoutTimer)
      clearInterval(pollTimer)
      cleanupRef.current = null
    }
    cleanupRef.current = cleanup
  })

  useUnmount(() => cleanupRef.current?.())
  return { openPopupWindow }
}
```

> **token 接收与 `usePopupLogin` 解耦**：`usePopupLogin` 只管理弹窗窗口的生命周期，token 接收由 `eventFactory` 统一管理，二者互不依赖。

### 5.4 `sendPopupToken` — popup 回传数据

**路径**：`src/pages/login/utils/sendPopupToken.ts`

```typescript
interface SendPopupTokenProps {
  token?: string         // 直接的 access_token（手机绑定完成后）
  loginType: Login.LoginType
  registerToken?: string // Apple pending_registration 场景
  loginTicket?: string   // Google / Apple bound 场景
}

function sendPopupToken(props: SendPopupTokenProps): void {
  const state = new URLSearchParams(window.location.search).get("state") ?? ""

  // iframe 模式
  if (window !== window.parent) {
    window.parent.postMessage({ type: "LOGIN_SUCCESS", ...props, state }, window.location.origin)
    return
  }

  // popup 模式
  BroadcastChannelSender.popupLogin({ ...props, state })
  setTimeout(() => window.close(), 300)
}
```

### 5.5 `LoginStore` — popup 回传数据的中转站

**路径**：`src/pages/login/store/index.ts`

```typescript
class LoginStore {
  isLoggingIn: boolean = false
  loginType: Login.LoginType | null = null    // popup 回传的登录类型
  loginTicket: string | null = null           // popup 回传的 login_ticket
  registerToken: string | null = null         // popup 回传的 register_token（Apple 特有）

  /**
   * 消费 popup 回传数据后立即调用。
   * 防止状态残留导致 observer 重渲染时 useEffect deps 再次变化，触发重复执行。
   */
  resetPopupState() {
    this.loginType = null
    this.loginTicket = null
    this.registerToken = null
  }
}
```

### 5.6 主窗口登录组件（`GoogleLogin` / `AppleLogin`）

每个支持 popup 的登录组件在主窗口中只实现一个初始化函数 `initWhenInMainWindow`，通过两个独立 `useEffect` 驱动：

```typescript
// ① 主窗口流程：监听 MobX store 值变化，popup 回传数据后换取 token
const initWhenInMainWindow = useMemoizedFn(async () => {
  const isGoogleLogin = loginStore.loginType === Login.LoginType.GoogleLogin
  const loginTicket = loginStore.loginTicket
  if (!isGoogleLogin || !loginTicket) return

  loginStore.resetPopupState()  // 先清除，再执行异步，防止重复换票
  const res = await LoginApi.exchangeLoginTicket({ login_ticket: loginTicket })
  await onSubmit(res, Login.LoginType.GoogleLogin, { redirect: "" })
})

// 将 MobX 可观察值读到组件作用域，observer 重渲染时 deps 才能感知到变化
const { loginType, loginTicket } = loginStore

useEffect(() => {
  initWhenInMainWindow().catch(...)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [loginType, loginTicket])   // useMemoizedFn 引用稳定，无需加入 deps

// ② 挂载时立即打开 popup（一次性行为）
useEffect(() => {
  openPopupLogin?.(getPopupLoginUrl(Login.LoginType.GoogleLogin))
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

> **历史对比**：早期版本中，登录组件还包含 `initWhenInPopupWindow` 函数和用于 popup 模式的第三个 `useEffect`，并通过 `isInPopupWindow` prop 路由到不同逻辑。这些全部已移除，popup 侧逻辑统一由 `useOAuthPopupHandler` 在 `PopupCallback` 页面处理。

---

## 六、useEffect 依赖设计

### 主窗口登录组件的 useEffect 结构（2 个）

```typescript
// ① 监听 store 变化，处理 popup 回传结果
const { loginType, loginTicket } = loginStore  // 从 observer 组件读取，deps 才能响应变化

useEffect(() => {
  initWhenInMainWindow().catch(...)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [loginType, loginTicket])

// ② 挂载时打开 popup（仅执行一次）
useEffect(() => {
  openPopupLogin?.(getPopupLoginUrl(loginType))
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

### popup 侧（useOAuthPopupHandler）的 useEffect 结构（1 个）

```typescript
useEffect(() => {
  handleOAuthCallback().catch(...)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.search])  // 挂载时 + OAuth 回跳后 URL 变化时各触发一次
```

> **为什么不把函数本身加入 deps？**
> `useMemoizedFn` 永远返回同一个引用，加入 deps 不会改变任何运行时行为，只是 ESLint 噪音。

---

## 七、状态重置时机

```
eventFactory 写入 loginStore
  ↓
observer 重渲染 → useEffect deps 变化 → initWhenInMainWindow 触发
  ↓
捕获到局部变量（loginTicket / registerToken）
  ↓
loginStore.resetPopupState()  ← 立即清除（同步，在任何 await 之前）
  ↓
执行异步操作（exchangeLoginTicket / setStage）
  ↓
observer 因 store → null 再次重渲染 → useEffect 再次触发
  ↓
initWhenInMainWindow 所有条件不满足 → 提前 return（幂等）
```

**为什么在 `await` 之前清除，而不是成功回调后？**

若在成功回调后清除，异步期间组件可能重渲染（如路由跳转导致重挂载），再次触发 effect 时 store 值仍存在，会发起第二次 `exchangeLoginTicket` 请求，而此时 ticket 已被服务端消费，导致 401 错误。

---

## 八、边界情况处理

| 场景 | 处理方式 |
|------|---------|
| 浏览器拦截弹窗 | `window.open` 返回 `null`，`logger.error` 提示用户手动允许 |
| 用户手动关闭弹窗 | `setInterval` 每 500ms 轮询 `popup.closed`，触发 `cleanup` |
| 登录操作超时 | `setTimeout` 5 分钟后强制 `popup.close()` 并清理定时器 |
| 组件卸载（弹窗仍开着） | `useUnmount` 调用 `cleanup()`，清理定时器避免内存泄漏 |
| 重复点击打开弹窗 | `cleanupRef.current?.()` 先关闭上一个，再打开新弹窗 |
| 多标签页同时监听 | `BroadcastChannel` 广播到所有同源 Tab，`state` 参数标识发起方，非发起方收到事件同样会更新 store 并执行登录（预期行为）|
| Apple 新用户首次登录 | `pending_registration` 路径：popup 传回 `registerToken`，主窗口渲染手机绑定表单 |

---

## 九、安全说明

- `sendPopupToken` 的 `postMessage` 调用使用 `window.location.origin` 作为 `targetOrigin`，**禁止使用 `'*'`**
- `BroadcastChannel` 天然同源限制，无需额外验证 `origin`
- `state` 参数从 URL 读取，用于标识发起方 Tab（供清理 `sessionStorage` 时比对），不作为拦截非发起方 Tab 处理 token 的依据
- 弹窗 URL 固定为 `${origin}/login-popup-callback`，不接受外部传入任意 URL，防止 Open Redirect

---

## 十、相关文件索引

| 文件路径 | 职责 |
|---------|------|
| `login-popup-callback.html` | popup 独立 HTML 入口，仅加载 `config.js` 和 `main.popup.tsx` |
| `src/main.popup.tsx` | popup 最小化 React 挂载（`BrowserRouter` + `PopupCallback`，无主应用初始化） |
| `src/pages/login/PopupCallback/index.tsx` | popup 页面根组件，仅调用 `useOAuthPopupHandler()`，渲染 `null` |
| `src/pages/login/PopupCallback/useOAuthPopupHandler.ts` | 统一处理 Google / Apple OAuth 回调，替代原各组件的 `initWhenInPopupWindow` |
| `src/pages/login/hooks/usePopupLogin.ts` | popup 窗口生命周期（open / timeout / poll / cleanup） |
| `src/pages/login/utils/sendPopupToken.ts` | popup→主窗口数据传递（BroadcastChannel / postMessage 双模式） |
| `src/pages/login/utils/index.ts` | `getPopupLoginUrl`、`logger` 等工具函数统一导出 |
| `src/pages/login/store/index.ts` | `LoginStore`：popup 回传数据的中转 MobX store，含 `resetPopupState` |
| `src/pages/login/components/GoogleLogin/index.tsx` | 主窗口 Google OAuth 实现（`initWhenInMainWindow` + 2 个 useEffect） |
| `src/pages/login/components/AppleLogin/index.tsx` | 主窗口 Apple OAuth 实现，含 `pending_registration` 分支 |
| `src/pages/login/components/PublicDeployment/index.tsx` | 登录入口，通过 `usePopupLogin` 注入 `openPopupLogin` prop |
| `src/opensource/broadcastChannel/index.ts` | `BroadcastChannelSender.popupLogin` 发送端封装 |
| `src/opensource/broadcastChannel/eventFactory/index.ts` | `EVENTS.POPUP_LOGIN` 接收端处理，写入 `loginStore` |
| `src/opensource/broadcastChannel/eventFactory/events.ts` | 事件名称枚举，含 `POPUP_LOGIN` |
| `src/const/routes.ts` | `RoutePath.LoginPopupCallback = "/login-popup-callback"` |
| `vite.config.ts` | `rollupOptions.input.loginPopupCallback` 独立构建入口 |
