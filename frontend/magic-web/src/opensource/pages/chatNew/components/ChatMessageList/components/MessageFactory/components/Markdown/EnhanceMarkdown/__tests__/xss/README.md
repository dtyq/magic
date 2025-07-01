# EnhanceMarkdown 组件安全测试套件

## 概述

本测试套件专门为 `EnhanceMarkdown` 组件设计，用于防范各种 XSS（跨站脚本）攻击。该组件处理用户输入的 Markdown 内容，存在潜在的安全风险，因此需要全面的安全测试来确保渲染安全性。

## 安全风险分析

### 主要风险点

1. **HTML 注入**：组件支持 `allowHtml` 属性，可能渲染恶意 HTML
2. **Script 执行**：恶意脚本标签可能被执行
3. **事件处理器**：HTML 事件属性可能被利用
4. **JavaScript 协议**：`javascript:` 协议的 URL 可能被执行
5. **LaTeX 注入**：LaTeX 功能可能存在注入风险
6. **自定义组件**：自定义组件配置可能被恶意利用
7. **流式渲染**：流式内容更新过程中的安全风险

## 测试用例分类

### 1. Script Tag XSS Prevention (脚本标签 XSS 防护)

```typescript
// 基础脚本注入
'<script>window.xssAttack = true;</script>Hello World'

// 代码块中的脚本
'```html\n<script>window.xssAttack2 = true;</script>\n```'

// 带属性的脚本标签
'<script type="text/javascript" src="malicious.js">window.xssAttack3 = true;</script>'
```

### 2. Event Handler XSS Prevention (事件处理器 XSS 防护)

```typescript
// 点击事件
'<div onclick="window.xssClick = true;">Click me</div>'

// 加载事件
'<img src="invalid.jpg" onload="window.xssLoad = true;" alt="test" />'

// 错误事件
'<img src="invalid.jpg" onerror="window.xssError = true;" alt="test" />'

// 其他事件处理器
['onmouseover', 'onmouseout', 'onfocus', 'onblur', 'onkeypress', 'onsubmit']
```

### 3. JavaScript Protocol XSS Prevention (JavaScript 协议 XSS 防护)

```typescript
// 链接中的 JavaScript 协议
'[Click me](javascript:window.xssJsProtocol = true;)'

// 图片中的 JavaScript 协议
'<img src="javascript:window.xssJsImg = true;" alt="test" />'

// Data URL 中的 JavaScript
'<a href="data:text/html,<script>window.xssDataUrl = true;</script>">Click</a>'
```

### 4. HTML Entity Encoding XSS Prevention (HTML 实体编码 XSS 防护)

```typescript
// HTML 实体编码的脚本标签
'&lt;script&gt;window.xssEntityScript = true;&lt;/script&gt;'

// 十六进制编码
'&#x3C;script&#x3E;window.xssHex = true;&#x3C;/script&#x3E;'

// 十进制编码
'&#60;script&#62;window.xssDecimal = true;&#60;/script&#62;'
```

### 5. CSS Injection XSS Prevention (CSS 注入 XSS 防护)

```typescript
// CSS 表达式
'<div style="background: expression(window.xssCss = true);">Test</div>'

// CSS 中的 JavaScript URL
'<div style="background-image: url(javascript:window.xssCssJs = true);">Test</div>'
```

### 6. Advanced Attack Vectors (高级攻击向量)

```typescript
// Unicode 脚本标签
'<\u0073cript>window.xssUnicode = true;</\u0073cript>'

// 嵌套脚本标签
'<scr<script>ipt>window.xssNested = true;</scr</script>ipt>'

// 大小写混合
'<ScRiPt>window.xssCase = true;</ScRiPt>'

// SVG 中的脚本
'<svg><script>window.xssSvg = true;</script></svg>'

// 零宽字符绕过
'<scr\u200Bipt>window.xssZeroWidth = true;</scr\u200Bipt>'
```

### 7. Polyglot XSS Attacks (多语言 XSS 攻击)

```typescript
// 多语言载荷
'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'window.xssPolyglot=true\'>'

// 上下文破坏
'"></script><script>window.xssContextBreak = true;</script>'
```

### 8. Filter Evasion Techniques (过滤器绕过技术)

```typescript
// 注释绕过
'<scr<!---->ipt>window.xssComment = true;</scr<!---->ipt>'

// 换行绕过
'<scr\nipt>window.xssNewline = true;</scr\nipt>'

// 制表符绕过
'<scr\tipt>window.xssTab = true;</scr\tipt>'
```

### 9. Markdown-specific Attack Vectors (Markdown 特定攻击向量)

```typescript
// 恶意引用链接
`[Click here][malicious]
[malicious]: javascript:window.xssReference = true;`

// 代码块中的 HTML
'```html\n<script>window.xssCodeBlock = true;</script>\n```'

// 内联代码中的脚本
'This is `<script>window.xssInlineCode = true;</script>` inline code'
```

### 10. LaTeX Injection Security (LaTeX 注入安全)

```typescript
// LaTeX 中的链接
'$\\href{javascript:window.xssLatex=true}{Click}$'

// LaTeX 命令注入
'$$\\begin{document}\\href{javascript:window.xssLatexCmd=true}{text}\\end{document}$$'
```

## 安全配置测试

### allowHtml=false 安全测试

确保当 `allowHtml` 设置为 `false` 时，HTML 内容被正确转义：

```typescript
{
  content: '<script>window.xssNoHtml = true;</script><b>Bold text</b>',
  allowHtml: false
}
```

### 流式渲染安全测试

确保在流式渲染过程中的内容更新不会引入安全风险：

```typescript
{
  content: '<script>window.xssStream = true;</script>Streaming content',
  isStreaming: true
}
```

### 自定义组件安全测试

测试自定义组件配置不会被恶意利用：

```typescript
{
  components: {
    script: MaliciousComponent
  }
}
```

## 性能和资源安全测试

### 内存耗尽防护

```typescript
// 超大内容
const largeContent = '<script>window.xssLarge = true;</script>'.repeat(10000)

// 深度嵌套
let nestedContent = '<script>window.xssNested = true;</script>'
for (let i = 0; i < 100; i++) {
  nestedContent = `<div>${nestedContent}</div>`
}
```

### 递归结构防护

```typescript
// 递归 Markdown 结构
let recursiveMarkdown = '<script>window.xssRecursive = true;</script>'
for (let i = 0; i < 50; i++) {
  recursiveMarkdown = `> ${recursiveMarkdown}`
}
```

## 错误处理安全测试

### 敏感信息泄露防护

确保错误处理过程中不会泄露敏感信息：

```typescript
const problematicContent = '<script>throw new Error("XSS attempt: " + document.cookie);</script>'
```

### 无效 Unicode 序列处理

```typescript
const invalidUnicode = '\uD800<script>window.xssInvalidUnicode = true;</script>\uDFFF'
```

## CSP (Content Security Policy) 合规性测试

### 内联样式检查

确保组件不会创建违反 CSP 的内联样式：

```typescript
const contentWithInlineStyles = '<div style="background: red; color: blue;">Test</div>'
```

### 动态脚本元素检查

确保组件不会创建动态脚本元素：

```typescript
const maliciousContent = '<script>window.xssCSP = true;</script>'
// 验证页面中不存在包含恶意代码的脚本元素
```

## 测试执行指南

### 运行测试

```bash
# 运行基础安全测试
npm test -- __tests__/security.test.tsx

# 运行高级安全测试
npm test -- __tests__/advanced-security.test.tsx

# 运行配置安全测试
npm test -- __tests__/security-config.test.tsx
```

### 测试覆盖率

建议这些安全测试应该覆盖以下场景：

1. **正常流程**：确保正常的 Markdown 内容能够正确渲染
2. **边界情况**：空内容、null/undefined 内容
3. **恶意输入**：各种 XSS 攻击向量
4. **配置组合**：不同的属性配置组合
5. **性能极限**：大量数据和深度嵌套
6. **错误处理**：异常情况的安全处理

## 安全建议

### 开发建议

1. **默认安全**：默认情况下应该禁用 HTML 渲染
2. **输入验证**：对所有用户输入进行严格验证
3. **输出编码**：确保所有输出都经过适当的编码
4. **CSP 策略**：实施严格的内容安全策略
5. **定期审计**：定期进行安全审计和测试

### 生产部署建议

1. **监控告警**：设置安全事件监控和告警
2. **日志记录**：记录所有可疑的输入和渲染尝试
3. **版本更新**：及时更新依赖库以修复安全漏洞
4. **权限控制**：实施适当的用户权限控制

## 结论

这个安全测试套件提供了全面的 XSS 攻击防护测试，涵盖了从基础的脚本注入到高级的多语言攻击向量。通过这些测试，可以确保 `EnhanceMarkdown` 组件在各种攻击场景下都能保持安全性。

定期运行这些测试，并根据新发现的攻击向量及时更新测试用例，是维护组件安全性的重要措施。 