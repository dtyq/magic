import { defineConfig } from 'vitepress'
import en from './locales/en'
import zh from './locales/zh'

// 中英文之间添加空格的函数
function addSpaceBetweenChineseAndEnglish(text: string): string {
  if (!text) return text
  
  // 在中文和英文之间添加空格
  return text
    // 在中文后面加空格(如果后面是英文)
    .replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2')
    // 在英文后面加空格(如果后面是中文)
    .replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2')
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Magic Docs",
  description: "The New Generation Enterprise-level AI Application Innovation Engine",
  locales: {
    root: en,
    zh: zh
  },
  ignoreDeadLinks: true,
  // Markdown配置
  markdown: {
    config: (md) => {
      // 保存原始的渲染器
      const originalRender = md.renderer.rules.text || ((tokens, idx, options, env, self) => {
        return self.renderToken(tokens, idx, options)
      })
      
      // 重写text标记的渲染方法
      md.renderer.rules.text = (tokens, idx, options, env, self) => {
        // 获取当前文本内容
        const content = tokens[idx].content
        
        // 处理文本，添加空格
        const processed = addSpaceBetweenChineseAndEnglish(content)
        
        // 替换原始内容
        tokens[idx].content = processed
        
        // 调用原始渲染器完成渲染
        return originalRender(tokens, idx, options, env, self)
      }
      
      // 处理内联标签中的文本
      if (md.renderer.rules.inline) {
        const originalInlineRender = md.renderer.rules.inline
        
        md.renderer.rules.inline = (tokens, idx, options, env, self) => {
          const token = tokens[idx]
          
          if (token.children) {
            token.children.forEach((child) => {
              if (child.type === 'text') {
                child.content = addSpaceBetweenChineseAndEnglish(child.content)
              }
            })
          }
          
          return originalInlineRender(tokens, idx, options, env, self)
        }
      }
    }
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    socialLinks: [
      { icon: 'github', link: 'https://github.com/dtyq/magic' }
    ],
    search: {
      provider: 'local'
    },
    outline: {
      level: 'deep',
    }
  }
}) 