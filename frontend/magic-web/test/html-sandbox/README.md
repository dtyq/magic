# HTML iframe sandbox contract tests

## 本地运行 / Run locally

在 `frontend/magic-web` 执行，使用当前 Worktree 的独立依赖：

```sh
pnpm install --frozen-lockfile
pnpm test:html-sandbox
```

- `pnpm test:html-sandbox:types`：仅检查已提取 iframe runtime 模块的严格类型。
- `pnpm test:html-sandbox:unit`：API、hooks/services、Renderer、代理和注入脚本定向测试。
- `pnpm test:html-sandbox:unit -t readFile`：单独运行匹配名称的方法测试。
- `pnpm test:html-sandbox:unit --coverage`：生成该范围的覆盖报告；不把行覆盖率当作浏览器验证。
- `pnpm test:html-sandbox:browser`：构建真实 runtime/prelude，启动临时静态 fixture 服务，用独立无头 Chrome 跑同源及跨源实例，返回非零状态表示失败，结束自动关闭服务和浏览器。
- `pnpm test:html-sandbox:examples`：打印本地地址，浏览器打开后选择实例并点击运行。修改 HTML 后重启此命令重新构建。结束按 Ctrl+C。

The default command checks the typed iframe installers, then runs focused unit/integration tests and real-browser examples.
The examples command leaves a loopback-only static server open for manual inspection.
It does not start the Magic application, require login, or call production APIs.

自动运行优先使用 Puppeteer 已安装的浏览器，没有时使用系统 Chrome；也可指定：

```sh
HTML_SANDBOX_CHROME="/absolute/path/to/chrome" pnpm test:html-sandbox:browser
```

CI 需预装 Chrome 或 Puppeteer 对应浏览器。未安装时命令明确失败，不跳过浏览器层。
生成的 shell、bundle 和 `browser-results.json`（本轮 ID/状态、逐项结果、浏览器错误、消息 trace）位于
`node_modules/.cache/html-sandbox-fixtures/`，不提交。报告在运行前重置，构建、启动、超时或清理失败也会写入本轮失败状态。

## 可运行 HTML / Executable examples

| HTML                      | 真实执行内容                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixtures/api.html`       | SDK 安装与别名、FS 文本/Blob/ArrayBuffer、列表与路径限制、Agent 消息、用户权限、DB CRUD、LLM HTTP/SSE、上传/附加/下载、并发、语言订阅、输入消息 |
| `fixtures/resources.html` | fetch、XHR、动态 script/link/img、嵌套 HTML、链接/window.open/location.href、hash 导航                                                          |
| `fixtures/storage.html`   | localStorage/sessionStorage/cookie、IndexedDB 升级/事务/读写、父端持久化及宿主隔离                                                              |
| `fixtures/devtools.html`  | 真正启用全部 DevTools 代理后执行网络和 API，transfer-list 二进制传输，关闭恢复，再次启用与防循环                                                |
| `fixtures/nested.html`    | 经真实 nested handler、HTML processor 和 srcdoc 执行的子文档                                                                                    |
| `fixtures/refresh.html`   | 新内容/同内容手动刷新重新执行 JS、旧定时器停止、普通重渲染/编辑不重启、跨文档存储保留                                                           |

这些文件是放进 Magic 沙箱的业务 HTML，不是独立 SDK 宿主页；直接双击 `api.html`
不会产生 `window.Magic`。通过本地实例页运行，才能验证真实的安装顺序与父子窗口通信。
Each example contains executable application code. The fixture host supplies the real
sandbox and bridge; do not open a child HTML file alone and interpret missing Magic as a failure.

资源只存在于 `/resolved-assets/`；原始相对路径强制返回 404。
因此移除任意 fetch/XHR/DOM 资源代理都不能靠浏览器原生加载蒙混通过。
同源用 `127.0.0.1`，跨源 shell 用 `localhost`；这是真正不同的 origin，
不是构造假的 MessageEvent。自动浏览器拒绝一切非当前端口的外部网络请求。

## 测试边界 / What is real and what is replaced

```text
HTML → production Magic prelude → native postMessage
     → React-mounted useIframeFS/LLM/Agent/UserInfo/Database/useMagicFiles
     → real service/path/permission/serialization logic
     → fixture external dependency → real response → HTML assertion
```

- `hook-host.tsx` 挂载真实 hooks 和 service。语言用例通过真实 i18next `changeLanguage` → `useIframeI18n` → iframe `Magic.i18n` 验证 lang、文案更新与两种取消订阅方式，并断言输入草稿保留。只替换后端适配器、登录态、上传下载副作用及用户授权界面。真实授权请求的 scope/reason 和顺序仍有断言。
- `host-dependencies.ts` 保存输入，`assert-dependencies.ts` 核对完整参数、真实 File 字节、项目/表/行身份、消息内容、权限时序和刷新归属。
- LLM token、模型、chat、SSE 使用真实 fetch 和解析器。静态 fixture 服务核对 HTTP method、授权、组织、模型及消息内容后才返回成功数据。
- runtime shell 使用包内生产构建脚本；prelude 使用生产 Vite 插件；full-content/fetch/nested/storage 使用源码，不替换成手写复制实现或空 prelude。
- API prelude 与 sandbox runtime 必须作为匹配版本构建/交付；本轮宿主消息校验复用 runtime 基类，不能仅更新 prelude 而保留旧的远端 shell。
- `IsolatedHTMLRenderer*.test.tsx` 另外验证真实组件（内部 Inner 通过公共包装组件调用）的握手、过期响应、来源检查、兄弟隔离、preview/edit/PPT、隐藏、reload、卸载，以及真实 UserInfo/Database 路由。与浏览器 fixture 的 hooks 宿主互补。

The browser host is intentionally small and does not mount the whole application renderer.
Component integration runs in jsdom; native frame isolation, injected code and real hook
round-trips run in Chrome. Neither proves live backend authorization or a deployed application.

刷新实例使用正式 Renderer 的 `usePreviewDocumentRevision`、生产 shell 和虚拟存储桥。
它实际等待旧定时器运行，再验证旧 Window 被销毁；不会仅过滤旧消息来冒充定时器清理。
文件获取/预处理竞争、真实 Renderer 握手、刷新反馈与草稿保护另外由组件和 hook 测试覆盖。

非编辑预览接收新文件内容后自动重建 iframe，重新执行脚本；手动刷新强制读取最新文件，
即使内容相同也重启页面。更新过程有状态提示，读取或渲染失败提供重试，不用超时冒充完成。
编辑中的未保存内容不会自动覆盖，仍通过现有服务端更新比较流程接受新内容。
新文档会等待宿主已接收的存储写入完成；尚未发送的消息或未提交事务不保证跨刷新保存。

## 用例维护 / Adding a contract

1. API 方法的参数、结果、失败、超时、取消等独立契约放在对应 `magic-api/__tests__`；聚合安装和 30 种请求协议矩阵防止方法遗漏。
2. 新浏览器行为写到对应 HTML 的 `Fixture.test(name, async () => ...)`，不要只匹配生成脚本文本。
3. 外部依赖只能在明确边界替换。不能 mock 被测 hook、service、代理或直接在父端伪造业务 API 成功响应。
4. 每个新外部调用补底层参数断言；等待响应/状态而非随意 sleep；不得依赖不同网络请求的偶然完成顺序。
5. 同源/跨源共用同一 HTML；用例失败继续记录，整套命令最终失败。准备失败、超时和完成都清理 iframe、hooks 和虚拟存储登记。

## 本轮修复与后续边界 / Regressions and follow-up

真实用例已暴露并修复：虚拟存储桥被旧 Cookie/IndexedDB mock 覆盖；
StorageInspector 读取受限 getter 时整次快照异常；MessageProxy 对原生 getter 使用错误 receiver。
保持无显式虚拟存储上下文的旧 standalone 行为。

第二阶段已把 telemetry、content metrics、ServiceWorker fallback、navigation bootstrap
及三个 legacy storage fallback 提取为 `HTML/iframe-runtime` 中的 TypeScript installer。
生产与测试共用构建器生成独立 IIFE，通过转义后的 JSON 参数调用，产物不手工维护。
模块类型、行为、参数转义、全局隔离及传递依赖修改后的重编译均有独立测试。
DevTools 分别核对首次启用、关闭、再次启用时的 console/network/API 记录，避免首次记录掩盖再次启用失效。

fetch、DOM 资源代理、嵌套 iframe、完整虚拟存储桥等复杂字符串模块仍待后续逐步迁移；
先补相应失败与恢复测试，再沿用同一编译入口，不能同时改变协议和断言来迁就重构。

第三阶段补充真实宿主 source/origin 校验（请求、FS watch、语言订阅和 LLM stream），
fetch 取消、XHR 请求头/认证重放及取消事件、动态 STYLE 文本更新、Cookie 到期、
IndexedDB 普通事务的只读/整组提交/取消/冲突保护。失败或取消不能报告提交成功。
独立 HTML 不再同时安装虚拟桥与 legacy 存储；重复注入保留原生存储引用。
缺少原生 Service Worker 时 register 明确拒绝，不虚报 worker 已激活；ready 保持等待。
原生 ready 只在真正存在活跃 worker 时完成，参见 [ServiceWorker ready](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/ready)。

### 入口上下文 / Entry contexts

| 场景          | 已验证的实际组合                                           | 证据层                         |
| ------------- | ---------------------------------------------------------- | ------------------------------ |
| 普通 HTML     | 当前项目文件读取、DB、当前会话写入                         | Renderer + 真实 hooks/services |
| 微应用预览    | 源项目文件/DB 与会话宿主分离；预览取消阻止发消息           | Renderer + 真实 hooks/services |
| 发布微应用    | 只读 API 不创建会话；写操作惰性取得宿主；登录失败不发送    | Renderer + 真实 hooks/services |
| 普通分享      | 源项目与 share access 传到底层；无会话宿主拒绝消息写入     | Renderer + 真实 hooks/services |
| 分享 PPT      | PPTSlide 将源 projectId 传入 Renderer，保持文件/存储作用域 | 实际消费者 + Renderer          |
| 同源/跨源沙箱 | 真正 HTML、生产脚本、原生 postMessage、资源与存储          | Chrome 可执行实例              |

`allowEdit=false` 是编辑 UI 控制，不是所有 Magic API 的统一只读权限。
文件来源与会话宿主分别传递，真实授权仍由相应权限流程和后端决定。
当前 worktree 没有企业/customer 对应覆盖层，不能据此宣称这些版本完成验证。
The matrix checks actual renderer composition in jsdom and actual iframe execution in Chrome;
it does not replace a full product navigation test with authenticated providers.

### 原生差异与后续范围 / Native gaps

- `Request` 构造后 URL 已绝对化，无法可靠推断原始输入是否相对路径；保持原生透传，不能改写所有绝对 URL。
- XHR 相对路径需异步向宿主解析；同步 XHR、解析失败的旧 synthetic 404 状态机还不等价于原生实现。
- IndexedDB 普通事务采用乐观提交，同库竞争返回 AbortError 以防覆盖；不同于原生排队调度。升级事务、完整游标/索引与错误冒泡仍不是完整 IndexedDB 实现。
- 请求/游标的 `onsuccess` 属性回调异常会取消事务；`addEventListener` 回调异常仍未完整模拟原生回滚。
- Cookie 提供 namespace 内键值与到期行为，不模拟完整 domain/path/SameSite/HttpOnly HTTP cookie jar。
- `srcset` 混入 data URL、Worker、模块 import 与表单提交没有完整资源桥契约；MutationObserver 事后改写也不能保证阻止所有首次原生加载。
- FS mutation 的声明返回 void 与运行时响应对象不一致，部分旧文档订阅靠版本抑制而非主动卸载，仍需独立契约评估。

优先明确这些能力的业务契约与失败反馈，再补可执行回归；不要用无条件成功的 mock 扩大“支持范围”。
后续复杂脚本迁移沿用已有 TS 编译入口，避免再次维护手工生成代码。
目前浏览器证据只覆盖 Chrome；真实 WebView、Firefox/Safari、线上后端与实际权限弹窗未验收。

语言切换通过订阅通知更新，不重载 iframe。`Magic.i18n.lang` 始终同步最新语言（`zh_CN` / `en_US`）；页面需在 `subscribe(({ lang }) => …)` 中更新自己的文案。可调用返回的取消函数，或 `unsubscribe` 传入原回调引用；取消后 lang 仍会更新。

浏览器用例通过 `setContent.runtimeUrl` 加载宿主生成的 `husky-runtime.js`，使用生产 CORS 响应函数；另有加载标记断言，避免 shell 内置 runtime 回退掩盖加载失败。正式服务仅允许配置中的明确来源，并返回 `Vary: Origin`；测试仅加入当前运行的两个 loopback 来源，不使用 runtime 通配授权。本地 pre 域名映射应在本地代理精确匹配 `/husky-runtime.js` 的 GET/HEAD 请求，返回当前 Worktree 的 runtime，并仅允许配置中的沙箱 Origin；这不应扩大正式服务的 CORS 范围。API 授权与 postMessage 来源检查不变。
