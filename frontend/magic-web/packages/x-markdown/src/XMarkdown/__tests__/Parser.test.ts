import Parser, { escapeHtml } from '../core/Parser';

describe('Parser', () => {
  it('should render paragraphs with custom tag when paragraphTag is provided', () => {
    const parser = new Parser({ paragraphTag: 'div' });
    const result = parser.parse('This is a paragraph.');
    expect(result).toBe('<div>This is a paragraph.</div>\n');
  });

  it('should render paragraphs with default p tag when paragraphTag is not provided', () => {
    const parser = new Parser();
    const result = parser.parse('This is a paragraph.');
    expect(result).toBe('<p>This is a paragraph.</p>\n');
  });

  it('should render multiple paragraphs with custom tag', () => {
    const parser = new Parser({ paragraphTag: 'section' });
    const result = parser.parse('This is the first paragraph.\n\nThis is the second paragraph.');
    expect(result).toBe(
      '<section>This is the first paragraph.</section>\n<section>This is the second paragraph.</section>\n',
    );
  });

  describe('openLinksInNewTab', () => {
    it('should add target="_blank" and rel="noopener noreferrer" to links when openLinksInNewTab is true', () => {
      const parser = new Parser({ openLinksInNewTab: true });
      const result = parser.parse('[Example](https://example.com)');
      expect(result).toBe(
        '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Example</a></p>\n',
      );
    });

    it('should not add target and rel attributes when openLinksInNewTab is false', () => {
      const parser = new Parser({ openLinksInNewTab: false });
      const result = parser.parse('[Example](https://example.com)');
      expect(result).toBe('<p><a href="https://example.com">Example</a></p>\n');
    });

    it('should not add target and rel attributes when openLinksInNewTab is not provided', () => {
      const parser = new Parser();
      const result = parser.parse('[Example](https://example.com)');
      expect(result).toBe('<p><a href="https://example.com">Example</a></p>\n');
    });

    it('should handle links with title attribute when openLinksInNewTab is true', () => {
      const parser = new Parser({ openLinksInNewTab: true });
      const result = parser.parse('[Example](https://example.com "Example Title")');
      expect(result).toBe(
        '<p><a href="https://example.com" title="Example Title" target="_blank" rel="noopener noreferrer">Example</a></p>\n',
      );
    });

    it('should handle multiple links in content', () => {
      const parser = new Parser({ openLinksInNewTab: true });
      const result = parser.parse(
        '[Link1](https://example1.com) and [Link2](https://example2.com)',
      );
      expect(result).toBe(
        '<p><a href="https://example1.com" target="_blank" rel="noopener noreferrer">Link1</a> and <a href="https://example2.com" target="_blank" rel="noopener noreferrer">Link2</a></p>\n',
      );
    });

    it('should handle reference-style links', () => {
      const parser = new Parser({ openLinksInNewTab: true });
      const result = parser.parse('[Example][1]\n\n[1]: https://example.com');
      expect(result).toBe(
        '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Example</a></p>\n',
      );
    });

    it('should work with custom marked config and openLinksInNewTab', () => {
      const parser = new Parser({
        markedConfig: { breaks: true },
        openLinksInNewTab: true,
      });
      const result = parser.parse('[Example](https://example.com)');
      expect(result).toBe(
        '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Example</a></p>\n',
      );
    });
  });

  describe('protectCustomTagNewlines', () => {
    it('should protect newlines inside custom tags when protectCustomTagNewlines is true', () => {
      const parser = new Parser({
        protectCustomTagNewlines: true,
        components: { CustomComponent: 'div' },
      });
      const content = '<CustomComponent>First line\n\nSecond line</CustomComponent>';
      const result = parser.parse(content);
      expect(result).toContain('<CustomComponent>First line\n\nSecond line</CustomComponent>');
      expect(result).not.toMatch(/<CustomComponent>First line<\/p>\s*<p>Second line/);
    });

    it('should not protect newlines when protectCustomTagNewlines is false', () => {
      const parser = new Parser({
        protectCustomTagNewlines: false,
        components: { CustomComponent: 'div' },
      });
      const content = '<CustomComponent>First line\n\nSecond line</CustomComponent>';
      const result = parser.parse(content);
      expect(result).toContain('<p>');
    });

    it('should work normally when protectCustomTagNewlines is true but no custom components', () => {
      const parser = new Parser({
        protectCustomTagNewlines: true,
      });
      const result = parser.parse('This is a paragraph.\n\nThis is another paragraph.');
      expect(result).toBe('<p>This is a paragraph.</p>\n<p>This is another paragraph.</p>\n');
    });

    it('should handle multiple custom tags', () => {
      const parser = new Parser({
        protectCustomTagNewlines: true,
        components: { CustomComponent1: 'div', CustomComponent2: 'span' },
      });
      const content =
        '<CustomComponent1>First\n\nSecond</CustomComponent1> and <CustomComponent2>Third\n\nFourth</CustomComponent2>';
      const result = parser.parse(content);
      expect(result).toContain('<CustomComponent1>First\n\nSecond</CustomComponent1>');
      expect(result).toContain('<CustomComponent2>Third\n\nFourth</CustomComponent2>');
    });

    it('should only protect newlines in outermost custom tags', () => {
      const parser = new Parser({
        protectCustomTagNewlines: true,
        components: { Outer: 'div', Inner: 'span' },
      });
      const content = '<Outer>Outer start\n<Inner>Inner\n\ncontent</Inner>\n\nOuter end</Outer>';
      const result = parser.parse(content);
      expect(result).toContain(
        '<Outer>Outer start\n<Inner>Inner\n\ncontent</Inner>\n\nOuter end</Outer>',
      );
    });

    it('should handle custom tags with attributes', () => {
      const parser = new Parser({
        protectCustomTagNewlines: true,
        components: { CustomComponent: 'div' },
      });
      const content = '<CustomComponent class="test">First line\n\nSecond line</CustomComponent>';
      const result = parser.parse(content);
      expect(result).toContain('class="test"');
      expect(result).toContain('First line\n\nSecond line');
    });

    it('should handle self-closing custom tags', () => {
      const parser = new Parser({
        protectCustomTagNewlines: true,
        components: { CustomComponent: 'div' },
      });
      const content = '<CustomComponent /> and <CustomComponent>Content\n\nhere</CustomComponent>';
      const result = parser.parse(content);
      expect(result).toContain('<CustomComponent />');
      expect(result).toContain('<CustomComponent>Content\n\nhere</CustomComponent>');
    });

    it('should protect newlines only in custom tags, not in regular markdown', () => {
      const parser = new Parser({
        protectCustomTagNewlines: true,
        components: { CustomComponent: 'div' },
      });
      const content =
        'Regular paragraph.\n\n<CustomComponent>Custom\n\ncontent</CustomComponent>\n\nAnother paragraph.';
      const result = parser.parse(content);
      expect(result).toContain('<p>Regular paragraph.</p>');
      expect(result).toContain('<CustomComponent>Custom\n\ncontent</CustomComponent>');
      expect(result).toContain('<p>Another paragraph.</p>');
    });

    it('should handle custom tags without double newlines', () => {
      const parser = new Parser({
        protectCustomTagNewlines: true,
        components: { CustomComponent: 'div' },
      });
      const content = '<CustomComponent>Single line content</CustomComponent>';
      const result = parser.parse(content);
      expect(result).toContain('<CustomComponent>Single line content</CustomComponent>');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML when encode is false or undefined and contains special characters', () => {
      expect(escapeHtml('test<script>alert("xss")</script>', false)).toBe(
        'test&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
      expect(escapeHtml('test<script>', undefined)).toBe('test&lt;script&gt;');
    });
  });
});
