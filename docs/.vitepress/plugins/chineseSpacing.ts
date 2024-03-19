/**
 * 中英文之间添加空格的VitePress插件
 * 在渲染时自动在中英文之间添加空格，不修改原始md文件
 */

// 匹配中文字符的正则表达式
const chineseRegex = /[\u4e00-\u9fa5]/
// 匹配英文字母的正则表达式
const englishRegex = /[a-zA-Z0-9]/

/**
 * 在中英文之间添加空格
 * @param text 需要处理的文本
 * @returns 处理后的文本
 */
function addSpaceBetweenChineseAndEnglish(text: string): string {
  if (!text) return text
  
  // 没有中文或英文，直接返回
  if (!chineseRegex.test(text) || !englishRegex.test(text)) return text
  
  // 在中文和英文之间添加空格
  return text
    // 在中文后面加空格(如果后面是英文)
    .replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2')
    // 在英文后面加空格(如果后面是中文)
    .replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2')
}

/**
 * 创建VitePress markdown-it插件
 */
export function chineseSpacingPlugin(md: any) {
  // 保存原始的渲染器
  const originalRender = md.renderer.rules.text
  
  // 重写text标记的渲染方法
  md.renderer.rules.text = (tokens: any[], idx: number, options: any, env: any, self: any) => {
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
  const originalInlineRender = md.renderer.rules.inline
  if (originalInlineRender) {
    md.renderer.rules.inline = (tokens: any[], idx: number, options: any, env: any, self: any) => {
      const token = tokens[idx]
      
      if (token.children) {
        token.children.forEach((child: any) => {
          if (child.type === 'text') {
            child.content = addSpaceBetweenChineseAndEnglish(child.content)
          }
        })
      }
      
      return originalInlineRender(tokens, idx, options, env, self)
    }
  }
}

/**
 * VitePress插件入口
 */
export default function chineseSpacing() {
  return {
    name: 'vitepress-plugin-chinese-spacing',
    enforce: 'pre' as const, // 明确指定为 'pre' 类型
    
    // 扩展VitePress配置
    config(config: any) {
      // 创建markdown配置如果不存在
      if (!config.markdown) {
        config.markdown = {}
      }
      
      // 确保config.markdown.config是一个函数
      const originalMarkdownConfig = config.markdown.config || (() => {})
      
      // 扩展markdown配置
      config.markdown.config = (md: any) => {
        // 应用原始配置
        originalMarkdownConfig(md)
        
        // 添加我们的插件
        md.use(chineseSpacingPlugin)
      }
    }
  }
} 