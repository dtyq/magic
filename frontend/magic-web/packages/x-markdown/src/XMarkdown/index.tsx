import { clsx } from 'clsx';
import React, { useMemo } from 'react';
import { Parser, Renderer } from './core';
import DebugPanel from './DebugPanel';
import { useStreaming } from './hooks';
import { XMarkdownProps } from './interface';
import { resolveTailContent } from './utils/tail';
import './index.css';

const XMarkdown: React.FC<XMarkdownProps> = React.memo((props) => {
  const {
    streaming,
    config,
    components,
    paragraphTag,
    content,
    children,
    rootClassName,
    className,
    style,
    openLinksInNewTab,
    dompurifyConfig,
    protectCustomTagNewlines,
    escapeRawHtml,
    debug,
    renderContent,
  } = props;
  const tailContent = useMemo(() => resolveTailContent(streaming?.tail), [streaming?.tail]);
  const TailComponent = typeof streaming?.tail === 'object' ? streaming.tail.component : undefined;
  const shouldShowTail = !!streaming?.hasNextChunk && tailContent;

  // ============================ style ============================
  const mergedCls = clsx('x-markdown', rootClassName, className);

  // ============================ Streaming ============================
  const output = useStreaming(content || children || '', { streaming, components });

  // ============================ Merge components with xmd-tail ============================
  const mergedComponents = useMemo(() => {
    if (!shouldShowTail) {
      return components;
    }

    const TailElement = TailComponent ? (
      React.createElement(TailComponent, { content: tailContent })
    ) : (
      <span className="xmd-tail">{tailContent}</span>
    );

    return {
      ...components,
      'xmd-tail': () => TailElement,
    };
  }, [shouldShowTail, components, TailComponent, tailContent]);

  // ============================ Render ============================
  const parser = useMemo(
    () =>
      new Parser({
        markedConfig: config,
        paragraphTag,
        openLinksInNewTab,
        components: mergedComponents,
        protectCustomTagNewlines,
        escapeRawHtml,
      }),
    [
      config,
      paragraphTag,
      openLinksInNewTab,
      mergedComponents,
      protectCustomTagNewlines,
      escapeRawHtml,
    ],
  );

  const renderer = useMemo(
    () =>
      new Renderer({
        components: mergedComponents,
        dompurifyConfig,
        streaming,
      }),
    [mergedComponents, dompurifyConfig, streaming],
  );

  const htmlString = useMemo(() => {
    if (!output) {
      return '';
    }

    return parser.parse(output, { injectTail: !!shouldShowTail });
  }, [output, parser, shouldShowTail]);

  const renderedContent = useMemo(
    () => (htmlString ? renderer.render(htmlString) : null),
    [htmlString, renderer],
  );

  const blocks = useMemo(() => {
    if (!renderedContent) return [];
    return React.Children.toArray(renderedContent)
      .filter(child => !(typeof child === 'string' && !child.trim()));
  }, [renderedContent]);

  if (!output) {
    return null;
  }

  return (
    <>
      <div className={mergedCls} style={style}>
        {renderContent ? renderContent(blocks) : renderedContent}
      </div>
      {debug ? <DebugPanel /> : null}
    </>
  );
});

if (process.env.NODE_ENV !== 'production') {
  XMarkdown.displayName = 'XMarkdown';
}

export default XMarkdown;
