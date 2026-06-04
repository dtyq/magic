import DOMPurify from 'dompurify';
import React from 'react';
import Renderer from '../core/Renderer';

// Mock React components for testing
const MockComponent: React.FC<any> = (props) => {
  return React.createElement('div', props);
};

describe('Renderer', () => {
  describe('detectUnclosedTags', () => {
    it('should detect unclosed custom tags', () => {
      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
      });

      // Access private method for testing
      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Test case 1: Unclosed tag
      const html1 = '<custom-tag>content';
      const result1 = detectUnclosedTags(html1);
      expect(result1.has('custom-tag-1')).toBe(true);

      // Test case 2: Closed tag
      const html2 = '<custom-tag>content</custom-tag>';
      const result2 = detectUnclosedTags(html2);
      expect(result2.size).toBe(0);

      // Test case 3: Self-closing tag
      const html3 = '<custom-tag />';
      const result3 = detectUnclosedTags(html3);
      expect(result3.size).toBe(0);
    });

    it('should handle multiple tags correctly', () => {
      const renderer = new Renderer({
        components: {
          'tag-a': MockComponent,
          'tag-b': MockComponent,
        },
      });

      // Access private method for testing
      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Test case: One closed, one unclosed
      const html = '<tag-a>content</tag-a><tag-b>content';
      const result = detectUnclosedTags(html);
      expect(result.size).toBe(1);
      expect(result.has('tag-a-1')).toBe(false);
      expect(result.has('tag-b-1')).toBe(true);
    });

    it('should ignore non-custom tags', () => {
      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
      });

      // Access private method for testing
      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Test case: Standard HTML tags should be ignored
      const html = '<div>content<p>paragraph';
      const result = detectUnclosedTags(html);
      expect(result.size).toBe(0);
    });

    it('should handle void elements correctly', () => {
      const renderer = new Renderer({
        components: {
          img: MockComponent,
        },
      });
      // Access private method for testing
      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Test case: Void elements should not be considered unclosed
      const html = '<img src="image.png"><img src="image2.png" />';
      const result = detectUnclosedTags(html);
      expect(result.size).toBe(0);

      // Test case: Unclosed void element
      const html2 = '<img src="image.p';
      const result2 = detectUnclosedTags(html2);
      expect(result2.has('img-1')).toBe(true);

      // Test case: Nested void elements
      const html3 = '<div><img src="image.png"></div><p>';
      const result3 = detectUnclosedTags(html3);
      expect(result3.size).toBe(0);
    });

    it('should handle HTML comments correctly', () => {
      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
      });

      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Comment inside closed tag - should be properly closed
      const html1 = '<custom-tag><!-- <unclosed> comment --></custom-tag>';
      const result1 = detectUnclosedTags(html1);
      expect(result1.size).toBe(0);

      // Comment before and after tag
      const html2 = '<!-- comment --><custom-tag>content</custom-tag><!-- end -->';
      const result2 = detectUnclosedTags(html2);
      expect(result2.size).toBe(0);

      // Comment before unclosed tag
      const html3 = '<!-- comment --><custom-tag>content';
      const result3 = detectUnclosedTags(html3);
      expect(result3.has('custom-tag-1')).toBe(true);
    });

    it('should handle CDATA sections correctly', () => {
      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
      });

      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // CDATA inside closed tag
      const html1 = '<custom-tag><![CDATA[<unclosed>]]></custom-tag>';
      const result1 = detectUnclosedTags(html1);
      expect(result1.size).toBe(0);

      // CDATA before tag
      const html2 = '<![CDATA[some data]]><custom-tag>content</custom-tag>';
      const result2 = detectUnclosedTags(html2);
      expect(result2.size).toBe(0);

      // CDATA before unclosed tag
      const html3 = '<![CDATA[data]]><custom-tag>content';
      const result3 = detectUnclosedTags(html3);
      expect(result3.has('custom-tag-1')).toBe(true);
    });

    it('should handle escaped quotes in attributes', () => {
      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
      });

      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Escaped double quotes in attribute
      const html1 = '<custom-tag attr="he said \\"hello\\"">content</custom-tag>';
      const result1 = detectUnclosedTags(html1);
      expect(result1.size).toBe(0);

      // Escaped single quotes in attribute
      const html2 = "<custom-tag attr='it\\'s fine'>content</custom-tag>";
      const result2 = detectUnclosedTags(html2);
      expect(result2.size).toBe(0);

      // Mixed quotes with escaped characters
      const html3 = '<custom-tag a="\\"test\\"" b="\'value\'">content</custom-tag>';
      const result3 = detectUnclosedTags(html3);
      expect(result3.size).toBe(0);
    });

    it('should handle multiple comments and CDATA mixed with tags', () => {
      const renderer = new Renderer({
        components: {
          'tag-a': MockComponent,
          'tag-b': MockComponent,
        },
      });

      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Complex HTML with comments, CDATA, and multiple tags
      const html = '<!-- start --><tag-a><!-- inner --><![CDATA[data]]></tag-a><tag-b>unclosed';
      const result = detectUnclosedTags(html);
      expect(result.size).toBe(1);
      expect(result.has('tag-b-1')).toBe(true);
      expect(result.has('tag-a-1')).toBe(false);
    });
  });

  describe('processHtml', () => {
    it('should pass correct streamStatus to custom components', () => {
      const components = {
        'streaming-component': MockComponent,
      };

      const renderer = new Renderer({ components });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Test case 1: Closed tag should have streamStatus="done"
      const html1 = '<streaming-component>content</streaming-component>';
      renderer.processHtml(html1);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          streamStatus: 'done',
        }),
      );

      createElementSpy.mockClear();

      // Note: Testing unclosed tags is more complex because html-react-parser
      // won't call the replace function for malformed HTML. In a real streaming
      // scenario, the HTML would be processed incrementally as it's received.

      createElementSpy.mockRestore();
    });

    it('should handle self-closing tags correctly', () => {
      const components = {
        'self-closing': MockComponent,
      };

      const renderer = new Renderer({ components });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Test case: Self-closing tag should have streamStatus="done"
      const html = '<self-closing />';
      renderer.processHtml(html);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          streamStatus: 'done',
        }),
      );

      createElementSpy.mockRestore();
    });

    it('should correctly process mixed content with custom components', () => {
      const components = {
        'component-a': MockComponent,
        'component-b': MockComponent,
      };

      const renderer = new Renderer({ components });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Test case: Mixed content with multiple custom components
      const html = '<p>Some text</p><component-a>Content A</component-a><component-b />More text';
      renderer.processHtml(html);

      // Verify that component-a was called with streamStatus="done" (closed tag)
      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          streamStatus: 'done',
        }),
      );

      createElementSpy.mockRestore();
    });

    it('should handle streaming scenario with unclosed tags', () => {
      const components = {
        'streaming-tag': MockComponent,
      };

      const renderer = new Renderer({ components });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // In a real streaming scenario, we might process HTML incrementally
      // For this test, we simulate the state at different points in the stream

      // First, process incomplete HTML (unclosed tag)
      const html1 = '<streaming-tag>Partial content';
      renderer.processHtml(html1);

      // Then, process complete HTML (closed tag)
      createElementSpy.mockClear();
      const html2 = '<streaming-tag>Partial content</streaming-tag>';
      renderer.processHtml(html2);

      // Verify that the component was called with streamStatus="done" (closed tag)
      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          streamStatus: 'done',
        }),
      );

      createElementSpy.mockRestore();
    });

    it('should handle multiple instances of the same component with correct streamStatus', () => {
      const components = {
        'multi-instance': MockComponent,
      };

      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Scenario: First instance is closed (done), second instance is open (loading)
      const html = '<multi-instance>Instance 1</multi-instance><multi-instance>Instance 2';
      renderer.processHtml(html);

      // Filter calls to MockComponent
      const calls = createElementSpy.mock.calls.filter((call) => call[0] === MockComponent);

      expect(calls.length).toBe(2);

      // First instance should be done
      expect(calls[0][1]).toEqual(
        expect.objectContaining({
          streamStatus: 'done',
        }),
      );

      // Second instance should be loading
      expect(calls[1][1]).toEqual(
        expect.objectContaining({
          streamStatus: 'loading',
        }),
      );

      createElementSpy.mockRestore();
    });

    it('should mark all instances as done when all are closed', () => {
      const components = {
        'multi-instance': MockComponent,
      };

      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      const html =
        '<multi-instance>Instance 1</multi-instance><multi-instance>Instance 2</multi-instance>';
      renderer.processHtml(html);

      const calls = createElementSpy.mock.calls.filter((call) => call[0] === MockComponent);

      expect(calls.length).toBe(2);
      expect(calls[0][1]).toEqual(expect.objectContaining({ streamStatus: 'done' }));
      expect(calls[1][1]).toEqual(expect.objectContaining({ streamStatus: 'done' }));

      createElementSpy.mockRestore();
    });

    it('should handle nested instances of the same component correctly', () => {
      const components = {
        'multi-instance': MockComponent,
      };

      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Outer open, Inner closed
      const html = '<multi-instance>Outer <multi-instance>Inner</multi-instance>';
      renderer.processHtml(html);

      const calls = createElementSpy.mock.calls.filter((call) => call[0] === MockComponent);
      expect(calls.length).toBe(2);

      // Inner instance (processed first as children are created before parent)
      expect(calls[0][1]).toEqual(expect.objectContaining({ streamStatus: 'done' }));
      // Outer instance
      expect(calls[1][1]).toEqual(expect.objectContaining({ streamStatus: 'loading' }));

      createElementSpy.mockRestore();
    });

    it('should handle deep nesting with mixed states', () => {
      const components = {
        'multi-instance': MockComponent,
      };

      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Level 1: Open
      // Level 2: Open
      // Level 3: Closed
      const html = '<multi-instance>1<multi-instance>2<multi-instance>3</multi-instance>';
      renderer.processHtml(html);

      const calls = createElementSpy.mock.calls.filter((call) => call[0] === MockComponent);
      expect(calls.length).toBe(3);

      // Level 3 (Inner most) - Done
      expect(calls[0][1]).toEqual(expect.objectContaining({ streamStatus: 'done' }));

      // Level 2 - Loading
      expect(calls[1][1]).toEqual(expect.objectContaining({ streamStatus: 'loading' }));

      // Level 1 - Loading
      expect(calls[2][1]).toEqual(expect.objectContaining({ streamStatus: 'loading' }));

      createElementSpy.mockRestore();
    });

    it('should handle interleaved components correctly', () => {
      const components = {
        'comp-a': MockComponent,
        'comp-b': MockComponent,
      };
      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      // comp-a closed, comp-b closed, comp-a open
      const html = '<comp-a>A1</comp-a><comp-b>B1</comp-b><comp-a>A2';
      renderer.processHtml(html);

      const callsA = createElementSpy.mock.calls.filter(
        (call) => call[0] === MockComponent && (call[1] as any).domNode.name === 'comp-a',
      );
      const callsB = createElementSpy.mock.calls.filter(
        (call) => call[0] === MockComponent && (call[1] as any).domNode.name === 'comp-b',
      );

      expect(callsA.length).toBe(2);
      expect(callsB.length).toBe(1);

      expect(callsA[0][1]).toEqual(expect.objectContaining({ streamStatus: 'done' }));
      expect(callsB[0][1]).toEqual(expect.objectContaining({ streamStatus: 'done' }));
      expect(callsA[1][1]).toEqual(expect.objectContaining({ streamStatus: 'loading' }));

      createElementSpy.mockRestore();
    });

    it('should merge class and className attributes correctly', () => {
      const components = {
        'test-component': MockComponent,
      };

      const renderer = new Renderer({
        components,
        dompurifyConfig: { ALLOWED_ATTR: ['class', 'className'] },
      });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Test case 1: Only class attribute
      const html1 = '<test-component class="custom-class">content</test-component>';
      renderer.processHtml(html1);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          className: 'custom-class',
        }),
      );

      createElementSpy.mockClear();

      // Test case 2: Only className attribute
      const html2 = '<test-component className="existing-class">content</test-component>';
      renderer.processHtml(html2);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          className: 'existing-class',
        }),
      );

      createElementSpy.mockClear();

      // Test case 3: Both class and className attributes
      const html3 =
        '<test-component class="new-class" className="existing-class">content</test-component>';
      renderer.processHtml(html3);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          className: 'existing-class new-class',
        }),
      );

      createElementSpy.mockClear();

      // Test case 4: Multiple classes in class attribute
      const html4 =
        '<test-component class="class1 class2" className="existing-class">content</test-component>';
      renderer.processHtml(html4);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          className: 'existing-class class1 class2',
        }),
      );

      createElementSpy.mockClear();

      // Test case 5: Empty class attribute
      const html5 = '<test-component class="" className="existing-class">content</test-component>';
      renderer.processHtml(html5);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          className: 'existing-class',
        }),
      );

      createElementSpy.mockClear();

      // Test case 6: Empty className attribute
      const html6 = '<test-component class="new-class" className="">content</test-component>';
      renderer.processHtml(html6);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          className: 'new-class',
        }),
      );

      createElementSpy.mockClear();

      // Test case 7: Both empty
      const html7 = '<test-component class="" className="">content</test-component>';
      renderer.processHtml(html7);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          className: '',
        }),
      );

      createElementSpy.mockRestore();
    });

    it('should handle class attribute merging with special characters', () => {
      const components = {
        'test-component': MockComponent,
      };

      const renderer = new Renderer({
        components,
        dompurifyConfig: { ALLOWED_ATTR: ['class', 'className'] },
      });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Test case: Classes with special characters
      const html =
        '<test-component class="btn btn-primary" className="custom-component">content</test-component>';
      renderer.processHtml(html);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          className: 'custom-component btn btn-primary',
        }),
      );

      createElementSpy.mockRestore();
    });

    it('should preserve other attributes while merging class and className', () => {
      const components = {
        'test-component': MockComponent,
      };

      const renderer = new Renderer({
        components,
        dompurifyConfig: { ALLOWED_ATTR: ['class', 'classname', 'id', 'data-test'] },
      });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Test case: Multiple attributes including class and className
      const html =
        '<test-component id="test-id" class="custom-class" classname="existing-class" data-test="value">content</test-component>';
      renderer.processHtml(html);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          id: 'test-id',
          className: 'existing-class custom-class',
          'data-test': 'value',
        }),
      );

      createElementSpy.mockRestore();
    });
  });

  describe('configureDOMPurify', () => {
    it('should configure DOMPurify with custom components', () => {
      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
          'another-tag': MockComponent,
        },
      });

      // Access private method for testing
      const configureDOMPurify = (renderer as any).configureDOMPurify.bind(renderer);
      const config = configureDOMPurify();

      expect(config.ADD_TAGS).toContain('custom-tag');
      expect(config.ADD_TAGS).toContain('another-tag');
    });

    it('should merge with user provided dompurifyConfig', () => {
      const userConfig = {
        ALLOWED_TAGS: ['div', 'span'],
        ALLOWED_ATTR: ['class', 'id'],
      };

      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
        dompurifyConfig: userConfig,
      });

      // Access private method for testing
      const configureDOMPurify = (renderer as any).configureDOMPurify.bind(renderer);
      const config = configureDOMPurify();

      expect(config.ADD_TAGS).toContain('custom-tag');
      expect(config.ALLOWED_TAGS).toContain('div');
      expect(config.ALLOWED_TAGS).toContain('span');
      expect(config.ALLOWED_ATTR).toContain('class');
      expect(config.ALLOWED_ATTR).toContain('id');
    });

    it('should handle empty components', () => {
      const renderer = new Renderer({});

      // Access private method for testing
      const configureDOMPurify = (renderer as any).configureDOMPurify.bind(renderer);
      const config = configureDOMPurify();

      expect(config.ADD_TAGS).toEqual([]);
    });

    it('should deduplicate tags in ADD_TAGS', () => {
      const userConfig = {
        ADD_TAGS: ['custom-tag', 'custom-tag2'],
      };

      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
        dompurifyConfig: userConfig,
      });

      // Access private method for testing
      const configureDOMPurify = (renderer as any).configureDOMPurify.bind(renderer);
      const config = configureDOMPurify();

      expect(config.ADD_TAGS).toEqual(['custom-tag', 'custom-tag2']);
      expect(config.ALLOWED_TAGS).toBeUndefined();
    });
  });

  describe('detectUnclosedTags edge cases', () => {
    it('should handle nested tags correctly', () => {
      const renderer = new Renderer({
        components: {
          'outer-tag': MockComponent,
          'inner-tag': MockComponent,
        },
      });

      // Access private method for testing
      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Test case: Properly nested and closed tags
      const html1 = '<outer-tag><inner-tag>content</inner-tag></outer-tag>';
      const result1 = detectUnclosedTags(html1);
      expect(result1.size).toBe(0);

      // Test case: Inner tag unclosed
      const html2 = '<outer-tag><inner-tag>content</outer-tag>';
      const result2 = detectUnclosedTags(html2);
      expect(result2.size).toBe(1);
      expect(result2.has('inner-tag-1')).toBe(true);
      expect(result2.has('outer-tag-1')).toBe(false);

      // Test case: Outer tag unclosed
      const html3 = '<outer-tag><inner-tag>content</inner-tag>';
      const result3 = detectUnclosedTags(html3);
      expect(result3.size).toBe(1);
      expect(result3.has('outer-tag-1')).toBe(true);
      expect(result3.has('inner-tag-1')).toBe(false);
    });

    it('should handle case insensitive tag names', () => {
      const renderer = new Renderer({
        components: {
          'test-tag': MockComponent,
        },
      });

      // Access private method for testing
      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Test case: Mixed case tags
      const html1 = '<Test-Tag>content';
      const result1 = detectUnclosedTags(html1);
      expect(result1.has('test-tag-1')).toBe(true);

      const html2 = '<TEST-TAG>content</TEST-TAG>';
      const result2 = detectUnclosedTags(html2);
      expect(result2.size).toBe(0);
    });

    it('should handle tags with attributes', () => {
      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
      });

      // Access private method for testing
      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Test case: Tag with attributes, unclosed
      const html1 = '<custom-tag class="test" id="my-id">content';
      const result1 = detectUnclosedTags(html1);
      expect(result1.has('custom-tag-1')).toBe(true);

      // Test case: Tag with attributes, closed
      const html2 = '<custom-tag class="test" id="my-id">content</custom-tag>';
      const result2 = detectUnclosedTags(html2);
      expect(result2.size).toBe(0);
    });

    it('should handle malformed HTML gracefully', () => {
      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
      });

      // Access private method for testing
      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Test case: Malformed closing tag
      const html1 = '<custom-tag>content</custom-tag';
      const result1 = detectUnclosedTags(html1);
      expect(result1.has('custom-tag-1')).toBe(true);

      // Test case: Missing closing bracket
      const html2 = '<custom-tag>content';
      const result2 = detectUnclosedTags(html2);
      expect(result2.has('custom-tag-1')).toBe(true);

      // Test case: Extra closing tags
      const html3 = '<custom-tag>content</custom-tag></custom-tag>';
      const result3 = detectUnclosedTags(html3);
      expect(result3.size).toBe(0);
    });

    it('should handle empty string', () => {
      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
      });

      // Access private method for testing
      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      const result = detectUnclosedTags('');
      expect(result.size).toBe(0);
    });

    it('should handle same tag multiple times', () => {
      const renderer = new Renderer({
        components: {
          'custom-tag': MockComponent,
        },
      });

      // Access private method for testing
      const detectUnclosedTags = (renderer as any).detectUnclosedTags.bind(renderer);

      // Test case: Multiple instances, some closed, some not
      const html = '<custom-tag>first</custom-tag><custom-tag>second';
      const result = detectUnclosedTags(html);
      expect(result.has('custom-tag-2')).toBe(true);
    });
  });

  describe('streamStatus integration', () => {
    it('should set streamStatus to loading for unclosed tags in processHtml', () => {
      const components = {
        'streaming-tag': MockComponent,
      };

      const renderer = new Renderer({ components });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Note: Due to html-react-parser behavior, we need to simulate the scenario
      // where we have valid HTML but want to test the streamStatus logic
      // We'll use a mock to control the detectUnclosedTags result
      const mockUnclosedTags = new Set(['streaming-tag-1']);
      jest.spyOn(renderer as any, 'detectUnclosedTags').mockReturnValue(mockUnclosedTags);

      const html = '<streaming-tag>content</streaming-tag>';
      renderer.processHtml(html);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          streamStatus: 'loading',
        }),
      );

      createElementSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should set streamStatus to done for closed tags in processHtml', () => {
      const components = {
        'streaming-tag': MockComponent,
      };

      const renderer = new Renderer({ components });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Mock detectUnclosedTags to return empty set (all tags closed)
      jest.spyOn(renderer as any, 'detectUnclosedTags').mockReturnValue(new Set());

      const html = '<streaming-tag>content</streaming-tag>';
      renderer.processHtml(html);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          streamStatus: 'done',
        }),
      );

      createElementSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should handle complex nested structures with partial component mapping', () => {
      const ArticleComponent: React.FC<any> = (props) => React.createElement('article', props);
      const SectionComponent: React.FC<any> = (props) => React.createElement('section', props);
      // Only map article and section, not div or p

      const components = {
        article: ArticleComponent,
        section: SectionComponent,
      };

      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<article><section><div><p>mixed content</p></div></section></article>';
      renderer.processHtml(html);

      // Only article and section should be matched as components
      const articleCalls = createElementSpy.mock.calls.filter(
        (call) => call[0] === ArticleComponent,
      );
      const sectionCalls = createElementSpy.mock.calls.filter(
        (call) => call[0] === SectionComponent,
      );

      expect(articleCalls).toHaveLength(1);
      expect(sectionCalls).toHaveLength(1);

      createElementSpy.mockRestore();
    });

    it('should handle recursive nesting with same component type', () => {
      const DivComponent: React.FC<any> = (props) => React.createElement('div', props);

      const components = {
        div: DivComponent,
      };

      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<div><div><div>deeply nested divs</div></div></div>';
      renderer.processHtml(html);

      // Should create 3 div components
      const divCalls = createElementSpy.mock.calls.filter((call) => call[0] === DivComponent);
      expect(divCalls).toHaveLength(3);

      createElementSpy.mockRestore();
    });

    it('should preserve component hierarchy in children prop', () => {
      const ParentComponent: React.FC<any> = (props) => React.createElement('div', props);
      const ChildComponent: React.FC<any> = (props) => React.createElement('span', props);
      const GrandchildComponent: React.FC<any> = (props) => React.createElement('strong', props);

      const components = {
        div: ParentComponent,
        span: ChildComponent,
        strong: GrandchildComponent,
      };

      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<div><span><strong>deep content</strong></span></div>';
      renderer.processHtml(html);

      // Verify the hierarchy is preserved in children
      const parentCall = createElementSpy.mock.calls.find((call) => call[0] === ParentComponent);
      expect(parentCall).toBeDefined();
      expect(parentCall![1]).toHaveProperty('children');

      createElementSpy.mockRestore();
    });
  });

  describe('className merging edge cases', () => {
    it('should handle undefined class attributes', () => {
      const components = {
        'test-component': MockComponent,
      };

      const renderer = new Renderer({ components });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Test case: Only other attributes, no class or className
      const html = '<test-component id="test-id" data-value="test">content</test-component>';
      renderer.processHtml(html);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          id: 'test-id',
          'data-value': 'test',
          className: '',
        }),
      );

      createElementSpy.mockRestore();
    });

    it('should handle whitespace in class attributes', () => {
      const components = {
        'test-component': MockComponent,
      };

      const renderer = new Renderer({
        components,
        dompurifyConfig: { ALLOWED_ATTR: ['class', 'classname'] },
      });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Test case: Extra whitespace in class attributes
      const html =
        '<test-component class="  class1   class2  " classname="  existing  ">content</test-component>';
      renderer.processHtml(html);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          className: 'existing class1   class2',
        }),
      );

      createElementSpy.mockRestore();
    });

    it('should handle classname attribute (lowercase)', () => {
      const components = {
        'test-component': MockComponent,
      };

      const renderer = new Renderer({
        components,
        dompurifyConfig: { ALLOWED_ATTR: ['classname'] },
      });

      // Mock createElement to capture props
      const createElementSpy = jest.spyOn(React, 'createElement');

      // Test case: Using "classname" (lowercase) instead of "className"
      const html = '<test-component classname="test-class">content</test-component>';
      renderer.processHtml(html);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          className: 'test-class',
        }),
      );

      createElementSpy.mockRestore();
    });
  });

  describe('DOMPurify integration', () => {
    it('should use DOMPurify with correct configuration', () => {
      const components = {
        'custom-tag': MockComponent,
      };

      const renderer = new Renderer({ components });

      // Spy on DOMPurify.sanitize
      const sanitizeSpy = jest.spyOn(DOMPurify, 'sanitize');

      const html = '<custom-tag>content</custom-tag><script>alert("xss")</script>';
      renderer.processHtml(html);

      expect(sanitizeSpy).toHaveBeenCalledWith(
        html,
        expect.objectContaining({
          ADD_TAGS: expect.arrayContaining(['custom-tag']),
        }),
      );

      sanitizeSpy.mockRestore();
    });

    it('should respect user dompurifyConfig', () => {
      const components = {
        'custom-tag': MockComponent,
      };

      const userConfig = {
        ALLOWED_TAGS: ['custom-tag'],
        ALLOWED_ATTR: ['class'],
      };

      const renderer = new Renderer({
        components,
        dompurifyConfig: userConfig,
      });

      // Spy on DOMPurify.sanitize
      const sanitizeSpy = jest.spyOn(DOMPurify, 'sanitize');

      const html = '<custom-tag class="test" id="test-id">content</custom-tag>';
      renderer.processHtml(html);

      expect(sanitizeSpy).toHaveBeenCalledWith(
        html,
        expect.objectContaining({
          ALLOWED_TAGS: expect.arrayContaining(['custom-tag']),
          ALLOWED_ATTR: expect.arrayContaining(['class']),
          ADD_TAGS: expect.arrayContaining(['custom-tag']),
        }),
      );

      sanitizeSpy.mockRestore();
    });
  });

  describe('render method', () => {
    it('should be an alias for processHtml', () => {
      const components = {
        'test-component': MockComponent,
      };

      const renderer = new Renderer({ components });

      // Spy on processHtml
      const processHtmlSpy = jest.spyOn(renderer, 'processHtml');

      const html = '<test-component>content</test-component>';
      const result = renderer.render(html);

      expect(processHtmlSpy).toHaveBeenCalledWith(html);
      expect(result).toBeDefined();

      processHtmlSpy.mockRestore();
    });
  });

  describe('nested components matching', () => {
    it('should match both parent and child components when both are provided in components', () => {
      const ParentComponent: React.FC<any> = (props) => {
        return React.createElement('div', { 'data-testid': 'parent', ...props });
      };
      const ChildComponent: React.FC<any> = (props) => {
        return React.createElement('span', { 'data-testid': 'child', ...props });
      };

      const components = {
        p: ParentComponent,
        a: ChildComponent,
      };

      const renderer = new Renderer({ components });

      // Mock createElement to capture all component calls
      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<p><a>link text</a></p>';
      renderer.processHtml(html);

      // Verify both p and a components were called
      const parentCall = createElementSpy.mock.calls.find((call) => call[0] === ParentComponent);
      const childCall = createElementSpy.mock.calls.find((call) => call[0] === ChildComponent);

      expect(parentCall).toBeDefined();
      expect(childCall).toBeDefined();

      // Verify parent contains child
      expect(parentCall![1]).toHaveProperty('children');

      createElementSpy.mockRestore();
    });

    it('should match deeply nested components', () => {
      const DivComponent: React.FC<any> = (props) => React.createElement('div', props);
      const SpanComponent: React.FC<any> = (props) => React.createElement('span', props);
      const StrongComponent: React.FC<any> = (props) => React.createElement('strong', props);

      const components = {
        div: DivComponent,
        span: SpanComponent,
        strong: StrongComponent,
      };

      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<div><span><strong>deeply nested</strong></span></div>';
      renderer.processHtml(html);

      // Verify all components were matched
      expect(createElementSpy).toHaveBeenCalledWith(DivComponent, expect.any(Object));
      expect(createElementSpy).toHaveBeenCalledWith(SpanComponent, expect.any(Object));
      expect(createElementSpy).toHaveBeenCalledWith(StrongComponent, expect.any(Object));

      createElementSpy.mockRestore();
    });

    it('should handle mixed custom and standard HTML tags', () => {
      const CustomP: React.FC<any> = (props) => React.createElement('p', props);
      const CustomA: React.FC<any> = (props) => React.createElement('a', props);

      const components = {
        p: CustomP,
        a: CustomA,
      };

      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<p><a href="/test">link</a> and <span>standard span</span></p>';
      renderer.processHtml(html);

      // Verify custom components were used
      expect(createElementSpy).toHaveBeenCalledWith(CustomP, expect.any(Object));
      expect(createElementSpy).toHaveBeenCalledWith(CustomA, expect.any(Object));

      createElementSpy.mockRestore();
    });

    it('should handle sibling components at same level', () => {
      const LiComponent: React.FC<any> = (props) => React.createElement('li', props);
      const StrongComponent: React.FC<any> = (props) => React.createElement('strong', props);

      const components = {
        li: LiComponent,
        strong: StrongComponent,
      };

      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<ul><li><strong>item1</strong></li><li><strong>item2</strong></li></ul>';
      renderer.processHtml(html);

      // Count how many times each component was called
      const liCalls = createElementSpy.mock.calls.filter((call) => call[0] === LiComponent);
      const strongCalls = createElementSpy.mock.calls.filter((call) => call[0] === StrongComponent);

      expect(liCalls).toHaveLength(2);
      expect(strongCalls).toHaveLength(2);

      createElementSpy.mockRestore();
    });
  });

  describe('unclosed tags scenarios', () => {
    it('should handle unclosed parent tags with closed child tags', () => {
      const ParentComponent: React.FC<any> = (props) => React.createElement('div', props);
      const ChildComponent: React.FC<any> = (props) => React.createElement('span', props);

      const components = {
        div: ParentComponent,
        span: ChildComponent,
      };

      const renderer = new Renderer({ components });

      // Mock detectUnclosedTags to simulate unclosed div
      const mockUnclosedTags = new Set(['div-1']);
      jest.spyOn(renderer as any, 'detectUnclosedTags').mockReturnValue(mockUnclosedTags);

      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<div><span>child content</span>'; // div is unclosed
      renderer.processHtml(html);

      // Verify both components are still matched
      const parentCall = createElementSpy.mock.calls.find((call) => call[0] === ParentComponent);
      const childCall = createElementSpy.mock.calls.find((call) => call[0] === ChildComponent);

      expect(parentCall).toBeDefined();
      expect(childCall).toBeDefined();

      // Verify parent has loading status due to unclosed tag
      expect(parentCall![1]).toHaveProperty('streamStatus', 'loading');
      // Child should have done status as it's properly closed
      expect(childCall![1]).toHaveProperty('streamStatus', 'done');

      createElementSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should handle unclosed child tags within closed parent tags', () => {
      const ParentComponent: React.FC<any> = (props) => React.createElement('div', props);
      const ChildComponent: React.FC<any> = (props) => React.createElement('span', props);

      const components = {
        div: ParentComponent,
        span: ChildComponent,
      };

      const renderer = new Renderer({ components });

      // Mock detectUnclosedTags to simulate unclosed span
      const mockUnclosedTags = new Set(['span-1']);
      jest.spyOn(renderer as any, 'detectUnclosedTags').mockReturnValue(mockUnclosedTags);

      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<div><span>child content</div>'; // span is unclosed
      renderer.processHtml(html);

      const parentCall = createElementSpy.mock.calls.find((call) => call[0] === ParentComponent);
      const childCall = createElementSpy.mock.calls.find((call) => call[0] === ChildComponent);

      expect(parentCall).toBeDefined();
      expect(childCall).toBeDefined();

      // Parent should have done status as it's properly closed
      expect(parentCall![1]).toHaveProperty('streamStatus', 'done');
      // Child should have loading status due to unclosed tag
      expect(childCall![1]).toHaveProperty('streamStatus', 'loading');

      createElementSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should handle multiple unclosed tags at different levels', () => {
      const DivComponent: React.FC<any> = (props) => React.createElement('div', props);
      const PComponent: React.FC<any> = (props) => React.createElement('p', props);
      const SpanComponent: React.FC<any> = (props) => React.createElement('span', props);

      const components = {
        div: DivComponent,
        p: PComponent,
        span: SpanComponent,
      };

      const renderer = new Renderer({ components });

      // Mock detectUnclosedTags to simulate unclosed div and span
      const mockUnclosedTags = new Set(['div-1', 'span-1']);
      jest.spyOn(renderer as any, 'detectUnclosedTags').mockReturnValue(mockUnclosedTags);

      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<div><p><span>content</p>'; // div and span are unclosed
      renderer.processHtml(html);

      const divCall = createElementSpy.mock.calls.find((call) => call[0] === DivComponent);
      const pCall = createElementSpy.mock.calls.find((call) => call[0] === PComponent);
      const spanCall = createElementSpy.mock.calls.find((call) => call[0] === SpanComponent);

      expect(divCall![1]).toHaveProperty('streamStatus', 'loading');
      expect(pCall![1]).toHaveProperty('streamStatus', 'done');
      expect(spanCall![1]).toHaveProperty('streamStatus', 'loading');

      createElementSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should handle completely unclosed nested structure', () => {
      const DivComponent: React.FC<any> = (props) => React.createElement('div', props);
      const PComponent: React.FC<any> = (props) => React.createElement('p', props);
      const AComponent: React.FC<any> = (props) => React.createElement('a', props);

      const components = {
        div: DivComponent,
        p: PComponent,
        a: AComponent,
      };

      const renderer = new Renderer({ components });

      // Mock detectUnclosedTags to simulate all tags unclosed
      const mockUnclosedTags = new Set(['div-1', 'p-1', 'a-1']);
      jest.spyOn(renderer as any, 'detectUnclosedTags').mockReturnValue(mockUnclosedTags);

      const createElementSpy = jest.spyOn(React, 'createElement');

      const html = '<div><p><a>unclosed content'; // All tags unclosed
      renderer.processHtml(html);

      const calls = createElementSpy.mock.calls;
      const divCall = calls.find((call) => call[0] === DivComponent);
      const pCall = calls.find((call) => call[0] === PComponent);
      const aCall = calls.find((call) => call[0] === AComponent);

      expect(divCall![1]).toHaveProperty('streamStatus', 'loading');
      expect(pCall![1]).toHaveProperty('streamStatus', 'loading');
      expect(aCall![1]).toHaveProperty('streamStatus', 'loading');

      createElementSpy.mockRestore();
      jest.restoreAllMocks();
    });
  });

  describe('support checkbox disabled and checked props', () => {
    it('disabled and checked are true', () => {
      const components = { input: MockComponent };
      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');
      const html1 = '<ul><li> <input checked="" disabled="" type="checkbox"/>checkbox</li></ul>';
      renderer.processHtml(html1);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({
          disabled: true,
          checked: true,
        }),
      );

      createElementSpy.mockClear();
    });

    it('disabled is true and no checked props', () => {
      const components = { input: MockComponent };
      const renderer = new Renderer({ components });
      const createElementSpy = jest.spyOn(React, 'createElement');
      const html = '<ul><li> <input disabled="" type="checkbox"/>checkbox</li></ul>';
      renderer.processHtml(html);

      expect(createElementSpy).toHaveBeenCalledWith(
        MockComponent,
        expect.objectContaining({ disabled: true }),
      );

      // 再确认这次调用里确实没有 checked
      const targetCall = createElementSpy.mock.calls.find((call) => call[0] === MockComponent);
      expect(targetCall?.[1]).not.toHaveProperty('checked');
      createElementSpy.mockClear();
    });
  });
});
