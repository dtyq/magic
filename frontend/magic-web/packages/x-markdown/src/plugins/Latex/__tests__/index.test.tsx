import { render } from '@testing-library/react';
import React from 'react';
import XMarkdown from '../../../XMarkdown';

// Mock CSS import to avoid Jest issues
jest.mock('katex/dist/katex.min.css', () => ({}));

// Import the actual plugin after mocking
import latexPlugin from '../index';

describe('LaTeX Plugin', () => {
  it('should render inline LaTeX with $..$ syntax', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>{'$E=mc^2$'}</XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should render inline LaTeX with $$\n..\n$$ syntax', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>
        {
          'latex: \n$$ \n f(\\lambda x + (1-\\lambda)y) \\leq \\lambda f(x) + (1-\\lambda) f(y) \n $$ '
        }
      </XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should render inline LaTeX with [\n..\n] syntax', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>
        {
          'latex: \n\\[L^{CLIP}(\\theta) = \\mathbb{E}_t \\left[ \\min\\left( r_t(\\theta) \\hat{A}_t, \\text{clip}(r_t(\\theta), 1-\\epsilon, 1+\\epsilon) \\hat{A}_t \\right) \\right]\\]\n end'
        }
      </XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should render block LaTeX with $$..$$ syntax', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>{'$$\\frac{a}{b}$$'}</XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should render block LaTeX with \\[..\\] syntax', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>{'\\[\\frac{a}{b}\\]'}</XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should handle LaTeX with surrounding text', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>
        {'This is an equation: $E=mc^2$ in text'}
      </XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should handle multiple LaTeX formulas', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>{'$a+b$ and $$\\frac{c}{d}$$'}</XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should handle align* syntax replacement', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>
        {'$$ \\begin{align*} x &= y \\ y &= z \\end{align*} $$'}
      </XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should handle empty content', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>{''}</XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should handle content without LaTeX', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>{'Just plain text'}</XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should handle complex LaTeX expressions', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>
        {'$\\sum_{i=1}^{n} x_i = \\prod_{j=1}^{m} y_j$'}
      </XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should handle mixed LaTeX syntaxes', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>
        {'Inline: $x^2$ and block: $$\\int_0^1 f(x)dx$$'}
      </XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should not throw error by default', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>
        {'latex: \n\n $$\n\\begin{align\n$$\n\n'}
      </XMarkdown>,
    );

    expect(container).toMatchSnapshot();
  });

  it('should throw error when config katexOption.throwOnError is true', () => {
    expect(() =>
      render(
        <XMarkdown config={{ extensions: latexPlugin({ katexOptions: { throwOnError: true } }) }}>
          {'latex: \n\n $$\n\\begin{align\n$$\n\n'}
        </XMarkdown>,
      ),
    ).toThrowErrorMatchingSnapshot();
  });

  it('should support inline block katex render: $$\n..\n$$', () => {
    expect(() =>
      render(
        <XMarkdown config={{ extensions: latexPlugin({ katexOptions: { throwOnError: true } }) }}>
          {
            'latex: \n\\[\n\\begin{align*}\n\\text{minimize}  \\quad & f_0(x) \\\\n\\text{subject to} \\quad & f_i(x) \\leq 0, \\quad i = 1, \\dots, m \\ \n& a_j^T x = b_j, \\quad j = 1, \\dots, p\n\\end{align*}\n\\]'
          }
        </XMarkdown>,
      ),
    ).toMatchSnapshot();
  });

  it('should support inline block katex render: \\[\n..\n\\]', () => {
    expect(() =>
      render(
        <XMarkdown config={{ extensions: latexPlugin({ katexOptions: { throwOnError: true } }) }}>
          {
            'latex: \n\\[\n\\begin{align*}\n\\text{minimize}  \\quad & f_0(x) \\\\n\\text{subject to} \\quad & f_i(x) \\leq 0, \\quad i = 1, \\dots, m \\ \n& a_j^T x = b_j, \\quad j = 1, \\dots, p\n\\end{align*}\n\\]'
          }
        </XMarkdown>,
      ),
    ).toMatchSnapshot();
  });

  it.each([
    {
      caseName: 'space after $$',
      content:
        '4. **speed**  \n   $$\n   v_{P,\\perp} = v_0 \\sin\\beta\n   $$ \n   $$\n   v_P = v_0\n   $$',
    },
    {
      caseName: 'no space after $$',
      content:
        '4. **speed**  \n   $$\n   v_{P,\\perp} = v_0 \\sin\\beta\n   $$\n   $$\n   v_P = v_0\n   $$',
    },
  ])('should parse consecutive block formulas with indentation ($caseName)', ({ content }) => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>{content}</XMarkdown>,
    );
    const katexElements = container.querySelectorAll('.katex-display');
    expect(katexElements).toHaveLength(2);
    expect(container).toMatchSnapshot();
  });

  it('should render multi-line \\[..\\] as block-level formula', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>
        {'content\n\\[\\frac{a}{b}\n\\]\ncontent'}
      </XMarkdown>,
    );

    // 验证渲染为块级公式
    expect(container.querySelector('.block-katex')).toBeInTheDocument();
    expect(container.querySelector('.inline-katex')).not.toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('should still render single-line \\[..\\] as inline formula', () => {
    const { container } = render(
      <XMarkdown config={{ extensions: latexPlugin() }}>{'hello \\[E=mc^2\\] world'}</XMarkdown>,
    );

    // 验证渲染为行内公式
    expect(container.querySelector('.inline-katex')).toBeInTheDocument();
    expect(container.querySelector('.block-katex')).not.toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });
});
