# Design style preview access / 设计风格预览访问

The deployed Express server serves preview HTML only for GET/HEAD requests with
`Sec-Fetch-Dest: iframe` and `Sec-Fetch-Site: same-origin`. Both headers must be
present. CSP `frame-ancestors 'self'` follows the resource origin automatically;
CSP sandbox and script blocking remain enabled.

部署后的 Express 服务仅允许携带上述两个请求头的同源 iframe GET/HEAD 请求。
CSP 的 `self` 自动匹配资源所在环境，不需要硬编码主站域名。

## Browser requirements / 浏览器要求

Preview requires a browser or embedded WebView that sends both Fetch Metadata
headers. Safari and iOS Safari require 16.4 or later. Embedded clients must be
checked using their actual engine and request headers, not their app version.
See [Safari 16.4 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-16_4-release-notes).

预览要求浏览器或内嵌 WebView 发送这两个 Fetch Metadata 请求头；Safari / iOS
Safari 至少需要 16.4。内嵌客户端必须按实际内核和请求头验证，不能只看客户端版本。
这是一项功能级限制，不能从项目 Browserslist 推断其兼容性。

Legacy fallback: when a browser sends neither header (Safari before 16.4), the
request is allowed only if its `Referer` host equals the `Host` header. If either
header is present, the strict check above applies and Referer is ignored. A
missing or cross-host Referer still returns 403. Referer can be forged or stripped
by privacy settings, so this is a compatibility measure, not a security boundary.

缺失或不符合要求的请求头会返回 403。旧版兼容：浏览器两个请求头都不发送（Safari 16.4 以前）
时，仅当 `Referer` 的主机与 `Host` 一致才放行；只要任一请求头存在，就按上述严格规则判断，
不看 Referer。Referer 缺失或跨主机仍返回 403。Referer 可被伪造或被隐私设置去除，
因此这只是兼容手段，不是安全边界。

## Security and caching / 安全与缓存

Fetch Metadata is a browser restriction, not authentication or download protection:
non-browser clients can forge these headers, and authorized viewers can inspect
responses. Preview responses use `private, no-cache` and vary on both metadata
headers (and `Referer` for the legacy fallback). Rejected requests use
`no-store`. Reverse proxies/CDNs must honor these headers and must not force shared caching of previews. This policy belongs to the
Express deployment server; it does not configure Vite's development server.

这不是鉴权或防下载机制：非浏览器工具可以伪造请求头，能够预览的用户仍可查看响应。
预览使用私有协商缓存，并按两个请求头区分缓存；拒绝响应不缓存。代理/CDN 必须遵守
这些响应头，不得强制公共缓存。上述规则用于 Express 部署服务，不配置 Vite 开发服务。
