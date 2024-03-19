import Editor, { OnChange } from '@monaco-editor/react';
import React, { ReactElement } from 'react';
import { xcodeDefault } from './themes';

interface QuietEditorProp {
  width?: string | number;
  height?: string | number;
  value?: string;
  language?: string;
  readOnly?: boolean;
  lineNumbers?: 'on' | 'off' | 'relative' | 'interval';
  folding?: boolean;
  renderLineHighlight?: 'all' | 'line' | 'none' | 'gutter';
  onChange?: OnChange;
}

const QuietEditor = (props: QuietEditorProp): ReactElement => {
  const {
    width,
    lineNumbers = 'on',
    height,
    value,
    folding = true,
    language,
    readOnly = false,
    renderLineHighlight = 'all',
    onChange,
  } = props;

  function editorWillMount(monaco: any) {
    monaco.editor.defineTheme('x-code-default', xcodeDefault);
  }

  return (
    <Editor
      height={height}
      width={width}
      value={value}
      language={language}
      onChange={onChange}
      beforeMount={editorWillMount}
      theme="x-code-default"
      options={{
        // 只读
        readOnly,
        // 关闭行数显示
        lineNumbers,
        // 关闭选中行的渲染
        renderLineHighlight,
        // 是否折叠
        folding,
        smoothScrolling: true,
        // 编辑器中字体大小
        fontSize: 13,
        // 是否可以滚动到最后一行，可以往上滚动超出内容范围
        scrollBeyondLastLine: false,
        // 左边空出来的宽度
        lineDecorationsWidth: 19,
        // 滚动条样式
        scrollbar: {
          verticalScrollbarSize: 5,
          horizontalScrollbarSize: 5,
        },
        // 小地图
        minimap: {
          enabled: false,
        },
      }}
    />
  );
};

export default QuietEditor;
