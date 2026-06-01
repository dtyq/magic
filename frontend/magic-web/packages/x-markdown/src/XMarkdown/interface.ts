import type { Config as DOMPurifyConfig } from 'dompurify';
import type { DOMNode } from 'html-react-parser';
import type { MarkedExtension, Tokens } from 'marked';
import type { CSSProperties, JSX } from 'react';

export interface AnimationConfig {
  /**
   * @description 淡入动画的持续时间（毫秒）
   * @description The duration of the fade-in animation in milliseconds
   * @default 200
   */
  fadeDuration?: number;
  /**
   * @description 动画的缓动函数
   * @description Easing function for the animation
   * @default 'ease-in-out'
   */
  easing?: string;
}

export enum StreamCacheTokenType {
  Text = 'text',
  Link = 'link',
  Image = 'image',
  Html = 'html',
  Emphasis = 'emphasis',
  List = 'list',
  Table = 'table',
  InlineCode = 'inline-code',
}

type Token = Tokens.Generic;

interface TailConfig {
  /**
   * @description 尾部显示的内容，默认为 `▋`
   * @description The content to display as tail, default is `▋`
   * @default '▋'
   */
  content?: string;
  /**
   * @description 自定义尾部组件，优先级高于 content
   * @description Custom tail component, takes precedence over content
   */
  component?: React.ComponentType<{ content?: string }>;
}

interface StreamingOption {
  /**
   * @description 指示是否还有后续内容块，为 false 时刷新所有缓存并完成渲染
   * @description Indicates whether more content chunks are expected. When false, flushes all cached content and completes rendering
   * @default false
   */
  hasNextChunk?: boolean;
  /**
   * @description 为块级元素（p、li、h1、h2、h3、h4）启用文字淡入动画
   * @description Enables text fade-in animation for block elements (p, li, h1, h2, h3, h4)
   * @default false
   */
  enableAnimation?: boolean;
  /**
   * @description 文字出现动画效果的配置
   * @description Configuration for text appearance animation effects
   */
  animationConfig?: AnimationConfig;
  /**
   * @description 是否启用尾部动画；传入 `true` 使用默认 `▋`，传入对象可自定义内容
   * @description Whether to enable tail animation; pass `true` for default `▋`, or object to customize content
   * @default false
   */
  tail?: boolean | TailConfig;
  /**
   * @description 未完成的 Markdown 格式转换为自定义加载组件的映射配置，用于在流式渲染过程中为未闭合的链接和图片提供自定义loading组件
   * @description Mapping configuration to convert incomplete Markdown formats to custom loading components, used to provide custom loading components for unclosed links and images during streaming rendering
   * @default { link: 'incomplete-link', image: 'incomplete-image' }
   */
  incompleteMarkdownComponentMap?: Partial<
    Record<
      Exclude<(typeof StreamCacheTokenType)[keyof typeof StreamCacheTokenType], 'text'>,
      string
    >
  >;
}

type StreamStatus = 'loading' | 'done';

type ComponentProps<T extends Record<string, unknown> = Record<string, unknown>> =
  React.HTMLAttributes<HTMLElement> & {
    /**
     * @description 组件对应的 DOM 节点，包含解析后的 DOM 节点信息
     * @description Component Element from html-react-parser, contains the parsed DOM node information
     */
    domNode: DOMNode;
    /**
     * @description 流式状态，`loading` 表示正在加载，`done` 表示加载完成
     * @description Streaming status, `loading` indicates streaming in progress, `done` indicates streaming complete
     */
    streamStatus: StreamStatus;
    /**
     * @description 代码块 info string（包含语言与参数，来自 marked 的 lang）
     * @description Fenced code info string (language + params, from marked lang)
     */
    lang?: string;
    /**
     * @description 是否为块级 code（仅 code 组件）
     * @description Whether it is a block code (code component only)
     */
    block?: boolean;
  } & T;

interface XMarkdownProps {
  /**
   * @description 需要渲染的 Markdown 内容
   * @description Markdown content to be rendered
   */
  content?: string;
  /**
   * @description Markdown 内容，作为 `content` 属性的别名
   * @description Markdown content, alias for `content` property
   */
  children?: string;
  /**
   * @description 用于替换 HTML 元素的自定义 React 组件映射，组件会接收 domNode、streamStatus 等属性
   * @description Custom React components to replace HTML elements, components receive domNode, streamStatus, etc.
   */
  components?: {
    [tagName: string]: React.ComponentType<ComponentProps> | keyof JSX.IntrinsicElements;
  };
  /**
   * @description 流式渲染行为的配置
   * @description Configuration for streaming rendering behavior
   */
  streaming?: StreamingOption;
  /**
   * @description Markdown 解析和扩展的 Marked.js 配置
   * @description Marked.js configuration for Markdown parsing and extensions
   */
  config?: MarkedExtension;
  /**
   * @description 根元素的额外 CSS 类名
   * @description Additional CSS class name for the root container
   */
  rootClassName?: string;
  /**
   * @description 根容器的额外 CSS 类名
   * @description Additional CSS class name for the root container
   */
  className?: string;
  /**
   * @description 段落元素的自定义 HTML 标签，防止自定义组件包含块级元素时的验证错误
   * @description Custom HTML tag for paragraph elements, prevents validation errors when custom components contain block-level elements
   * @default 'p'
   */
  paragraphTag?: keyof JSX.IntrinsicElements;
  /**
   * @description 根容器的内联样式
   * @description Inline styles for the root container
   */
  style?: CSSProperties;
  /**
   * @description 组件的 CSS 类名前缀
   * @description CSS class name prefix for the component
   */
  prefixCls?: string;
  /**
   * @description 是否为所有锚点标签添加 `target="_blank"`
   * @description Whether to add `target="_blank"` to all anchor tags
   * @default false
   */
  openLinksInNewTab?: boolean;
  /**
   * @description HTML 净化和 XSS 防护的 DOMPurify 配置
   * @description DOMPurify configuration for HTML sanitization and XSS protection
   */
  dompurifyConfig?: DOMPurifyConfig;
  /**
   * @description 是否保护自定义标签中的换行符
   * @description Whether to protect newlines in custom tags
   * @default false
   */
  protectCustomTagNewlines?: boolean;
  /**
   * @description 是否将 Markdown 中的原始 HTML 转义为纯文本展示（不解析为真实 HTML），避免 XSS 同时保留内容
   * @description Whether to escape raw HTML in Markdown as plain text (not parsed as real HTML), avoiding XSS while preserving content
   * @default false
   */
  escapeRawHtml?: boolean;
  /*
   * @description 是否启用调试模式，显示性能监控浮层，包含 FPS、内存占用、渲染时间等关键指标
   * @description Whether to enable debug mode, displaying performance monitoring overlay with FPS, memory usage, render time and other key metrics
   * @default false
   */
  debug?: boolean;
  /**
   * @description 自定义内容渲染函数，接收解析后的 block 级 React 元素数组，返回自定义渲染结果（可用于虚拟滚动等场景）
   * @description Custom content render function that receives an array of block-level React elements and returns custom rendered output (useful for virtual scrolling, etc.)
   */
  renderContent?: (blocks: React.ReactNode[]) => React.ReactNode;
}

export type {
  XMarkdownProps,
  Token,
  Tokens,
  StreamStatus,
  ComponentProps,
  StreamingOption,
  TailConfig,
};
