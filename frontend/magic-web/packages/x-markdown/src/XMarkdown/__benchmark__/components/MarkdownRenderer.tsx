import MarkdownIt from 'markdown-it';
// @ts-ignore - benchmark only, ignore type checking
import markdownItKatex from 'markdown-it-katex';
import { Marked } from 'marked';
import React, { FC } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { Streamdown } from 'streamdown';
import getLatex from '../../../plugins/Latex';
import XMarkdown from '../../index';

type MarkdownRendererProps = {
  md: string;
  hasNextChunk?: boolean;
};

const md = new MarkdownIt();
// benchmark only: bypass TS check
md.use(markdownItKatex);
const marked = new Marked({ extensions: getLatex() });

const MarkedRenderer: FC<MarkdownRendererProps> = (props) => (
  <div
    className="markdown-container"
    // biome-ignore lint/security/noDangerouslySetInnerHtml: benchmark only
    dangerouslySetInnerHTML={{ __html: marked.parse(props.md) as string }}
  />
);

const MarkdownItRenderer: FC<MarkdownRendererProps> = (props) => {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: benchmark only
    <div className="markdown-container" dangerouslySetInnerHTML={{ __html: md.render(props.md) }} />
  );
};

const ReactMarkdownRenderer: FC<MarkdownRendererProps> = (props) => (
  <div className="markdown-container">
    <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeKatex]} remarkPlugins={[remarkGfm, remarkMath]}>
      {props.md}
    </ReactMarkdown>
  </div>
);

const XMarkdownRenderer: FC<MarkdownRendererProps> = (props) => (
  <div className="markdown-container">
    <XMarkdown
      streaming={{ hasNextChunk: props?.hasNextChunk, enableAnimation: true }}
      config={{ extensions: getLatex() }}
    >
      {props.md}
    </XMarkdown>
  </div>
);

const StreamdownRenderer: FC<MarkdownRendererProps> = (props) => (
  <div className="markdown-container">
    <Streamdown rehypePlugins={[rehypeRaw, rehypeKatex]} remarkPlugins={[remarkGfm, remarkMath]}>
      {props.md}
    </Streamdown>
  </div>
);

const Empty = () => <div />;

export {
  MarkedRenderer,
  MarkdownItRenderer,
  ReactMarkdownRenderer,
  XMarkdownRenderer,
  StreamdownRenderer,
  Empty,
};
