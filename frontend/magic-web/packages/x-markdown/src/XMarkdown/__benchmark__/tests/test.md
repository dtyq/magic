# Performance Test Document - Complex Markdown Structure Benchmark

## 1. Introduction and Overview

This document is specifically designed to test the performance of Markdown parsers, containing various complex Markdown structures and large amounts of content. By parsing this document, we can comprehensively evaluate the parser's performance metrics when handling large-scale, complex structures.

### 1.1 Test Objectives

- Evaluate the parser's ability to handle large files
- Test parsing efficiency of complex nested structures
- Verify support for various Markdown extended syntax
- Measure memory usage and CPU utilization

### 1.2 Document Structure Description

This document contains the following main sections:

1. Multi-level heading structure
2. Large text content
3. Complex table structures
4. Various code blocks and syntax highlighting
5. Nested list structures
6. Quotes and annotations
7. Links and images
8. Mathematical formulas (if supported)

## 2. Technical Specifications and Standards

### 2.1 Markdown Standard Support

| Feature       | Standard Support | Extended Support | Notes                         |
| ------------- | ---------------- | ---------------- | ----------------------------- |
| Basic Syntax  | ✅               | ✅               | Fully supported               |
| Tables        | ✅               | ✅               | Support alignment and nesting |
| Code Blocks   | ✅               | ✅               | Support syntax highlighting   |
| Task Lists    | ❌               | ✅               | Requires extended support     |
| Math Formulas | ❌               | ✅               | Requires MathJax or KaTeX     |
| Flowcharts    | ❌               | ✅               | Requires Mermaid support      |
| Footnotes     | ❌               | ✅               | Requires extended syntax      |

### 2.2 Performance Benchmark Requirements

```yaml
performance:
  parsing:
    max_time: 1000ms
    max_memory: 50MB
  rendering:
    max_time: 2000ms
    max_memory: 100MB
  file_size:
    min: 100KB
    max: 1MB
```

## 3. Detailed Content Sections

### 3.1 Long-form Content Test

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.

### 3.2 Nested Structure Test

#### 3.2.1 Three-level Nested Headings

##### 3.2.1.1 Four-level Nested Headings

###### 3.2.1.1.1 Five-level Nested Headings

This is a deeply nested heading structure used to test the parser's ability to handle deep-level headings.

#### 3.2.2 List Nesting Test

1. First-level list item
   - Second-level unordered list
     - Third-level unordered list
       1. Fourth-level ordered list
          - Fifth-level mixed list
            - Sixth-level deep nesting
              - Seventh-level extreme nesting
                - Eighth-level test
                  - Ninth-level boundary test
                    - Tenth-level maximum nesting

2. Complex list item content test
   - **Bold text** in lists
   - _Italic text_ in lists
   - `Code snippets` in lists
   - [Link text](https://example.com) in lists
   - ![Image alt](https://via.placeholder.com/50x50) in lists

### 3.3 Code Block Test

#### 3.3.1 Multi-language Code Highlighting

```javascript
// JavaScript code example
class PerformanceTest {
  constructor(name) {
    this.name = name;
    this.startTime = Date.now();
  }

  measureTime() {
    const endTime = Date.now();
    return endTime - this.startTime;
  }

  async runTests() {
    const results = [];
    for (let i = 0; i < 1000; i++) {
      results.push(await this.singleTest(i));
    }
    return results;
  }
}

const test = new PerformanceTest('markdown-parser');
test.runTests().then(console.log);
```

```python
# Python code example
import asyncio
import time
from typing import List, Dict

class MarkdownBenchmark:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.results = []

    async def parse_file(self) -> Dict[str, float]:
        start_time = time.time()
        # Simulate complex markdown parsing process
        with open(self.file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Complex parsing logic would be here
            parsed = self._complex_parse(content)

        end_time = time.time()
        return {
            'duration': end_time - start_time,
            'file_size': len(content),
            'parsed_length': len(parsed)
        }

    def _complex_parse(self, content: str) -> str:
        # Simulate complex parsing process
        return content.upper()

if __name__ == "__main__":
    benchmark = MarkdownBenchmark("test.md")
    asyncio.run(benchmark.parse_file())
```

```sql
-- SQL query example
SELECT
    p.id,
    p.title,
    p.content,
    p.created_at,
    COUNT(c.id) as comment_count,
    AVG(r.rating) as avg_rating
FROM
    posts p
LEFT JOIN
    comments c ON p.id = c.post_id
LEFT JOIN
    ratings r ON p.id = r.post_id
WHERE
    p.status = 'published'
    AND p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY
    p.id
ORDER BY
    avg_rating DESC,
    comment_count DESC
LIMIT 100;
```

```json
{
  "benchmark": {
    "name": "markdown-parser-performance",
    "version": "1.0.0",
    "tests": [
      {
        "name": "parsing-speed",
        "iterations": 1000,
        "expected": {
          "max_time_ms": 1000,
          "max_memory_mb": 50
        }
      },
      {
        "name": "rendering-speed",
        "iterations": 100,
        "expected": {
          "max_time_ms": 2000,
          "max_memory_mb": 100
        }
      }
    ],
    "metrics": {
      "file_size": "1MB",
      "complexity": "high",
      "structures": ["tables", "code", "lists", "quotes", "math"]
    }
  }
}
```

#### 3.3.2 Line Number Display Test

```javascript {1,3-5}
// This line shows line numbers
function test() {
  // These lines also show line numbers
  const a = 1;
  const b = 2;
  return a + b; // This line does not show line numbers
}
```

### 3.4 Math Formula Test (if supported)

#### 3.4.1 Inline Formulas

This is an inline math formula: $E=mc^2$, it should render correctly.  
Inline formula with Greek: $\alpha + \beta = \gamma$.  
Inline fraction: $\frac{a}{b} + \frac{c}{d} = \frac{ad+bc}{bd}$.

#### 3.4.2 Block Formulas

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

$$
\begin{align}
\frac{d}{dx}\left( \int_{0}^{x} f(u)\,du\right) &= f(x) \\
\frac{d}{dx}\left( \int_{a(x)}^{b(x)} f(u)\,du\right) &= f(b(x))b'(x) - f(a(x))a'(x)
\end{align}
$$

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

$$
\mathbf{A} = \begin{pmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{pmatrix}
$$

$$
\lim_{x \to 0} \frac{\sin x}{x} = 1
$$

### 3.5 Task List Test

#### 3.5.1 Basic Task Lists

- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task
- [ ] Todo item 1
- [ ] Todo item 2

#### 3.5.2 Nested Task Lists

- [x] Main task
  - [x] Subtask 1
  - [ ] Subtask 2
    - [x] Sub-subtask 1
    - [ ] Sub-subtask 2
- [ ] Independent task

### 3.6 Table Complexity Test

#### 3.6.1 Basic Complex Table

| Header1         | Header2  | Header3  | Header4            | Header5                     |
| --------------- | -------- | -------- | ------------------ | --------------------------- |
| Cell1           | Cell2    | Cell3    | Cell4              | Cell5                       |
| Merge cell test |          |          | Span three columns |                             |
| New row1        | **Bold** | _Italic_ | `Code`             | [Link](https://example.com) |

#### 3.6.2 Nested Content Table

| Feature    | Description             | Example                                        | Status |
| ---------- | ----------------------- | ---------------------------------------------- | ------ |
| Images     | Support image insertion | ![Example](https://via.placeholder.com/100x50) | ✅     |
| Math       | Support LaTeX           | $E=mc^2$                                       | ⚠️     |
| Flowcharts | Support Mermaid         | `mermaid<br>graph LR<br>A-->B`                 | ❌     |
| Tables     | Support complex tables  | As shown above                                 | ✅     |

#### 3.6.3 Large Data Table

| ID | Name | Type | Size | Created | Modified | Permissions | Owner | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | document.md | file | 1024KB | 2024-01-01 10:00:00 | 2024-01-02 11:30:00 | 644 | user1 | group1 | Main document |
| 2 | image.png | file | 2048KB | 2024-01-01 10:30:00 | 2024-01-01 10:30:00 | 755 | user2 | group2 | Example image |
| 3 | folder | dir | 4096KB | 2024-01-01 09:00:00 | 2024-01-03 14:20:00 | 755 | user1 | group1 | Project folder |
| 4 | script.js | file | 512KB | 2024-01-02 15:00:00 | 2024-01-02 15:30:00 | 700 | user3 | group3 | Config file |
| 5 | data.json | file | 256KB | 2024-01-03 09:15:00 | 2024-01-03 09:15:00 | 644 | user1 | group1 | Data file |

### 3.7 Quote and Annotation Test

> This is a quote block used to test quote format parsing.
>
> Quotes can contain multi-line content and support internal formatting:
>
> - **Bold text** in quotes
> - _Italic text_ in quotes
> - `Code snippets` in quotes
>
> > Nested quote
> >
> > > Three-level nested quote
> > >
> > > This is the deepest quote content, containing [links](https://example.com) and **formatted text**.

### 3.8 Link and Image Test

#### 3.8.1 Various Link Formats

- [Inline link](https://example.com)
- [Link with title](https://example.com 'Link title')
- [Relative link](../README.md)
- [Anchor link](#introduction-and-overview)
- <https://automatic-link.com>
- [Reference link][reference]

[reference]: https://example.com 'Reference link'

#### 3.8.2 Image Test

![Regular image](https://via.placeholder.com/200x100) ![Image with alt](https://via.placeholder.com/200x100 'Image title') ![Small icon](https://via.placeholder.com/16x16)

## 4. Repetitive Content Test (increasing file size)

### 4.1 Repeated Paragraph 1

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

### 4.2 Repeated Paragraph 2

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

### 4.3 Repeated Paragraph 3

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

### 4.4 Repeated Paragraph 4

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

### 4.5 Repeated Paragraph 5

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.

## 5. Large Table Data

### 5.1 Performance Test Data Table

| Test Case        | File Size | Parse Time | Memory Usage | CPU Usage | Status |
| ---------------- | --------- | ---------- | ------------ | --------- | ------ |
| Small file       | 1KB       | 5ms        | 2MB          | 5%        | ✅     |
| Medium file      | 10KB      | 25ms       | 5MB          | 15%       | ✅     |
| Large file       | 100KB     | 150ms      | 15MB         | 45%       | ✅     |
| Extra large file | 1MB       | 1200ms     | 50MB         | 85%       | ⚠️     |
| Extreme file     | 10MB      | 15000ms    | 200MB        | 95%       | ❌     |

### 5.2 Feature Support Matrix

| Parser | Basic Syntax | Tables | Code Highlighting | Math Formulas | Flowcharts | Footnotes | Task Lists |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ParserA | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ParserB | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ParserC | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ParserD | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |

## 6. Complex Nested Structure Test

### 6.1 Code Blocks in Lists

1. Code block in ordered list

   ```python
   def test_function():
       print("This is a code block in an ordered list")
       return True
   ```

2. Another code block
   ```javascript
   const listItemCode = () => {
     console.log('JavaScript code in list item');
   };
   ```

### 6.2 Lists in Quotes

> Lists in quotes:
>
> 1. First item
>    - Subitem 1
>    - Subitem 2
> 2. Second item
>    - Subitem A
>    - Subitem B

### 6.3 Code in Tables

| Language   | Example Code                        | Description     |
| ---------- | ----------------------------------- | --------------- |
| Python     | `print("Hello World")`              | Simple output   |
| JavaScript | `console.log("Hello World")`        | Console output  |
| Java       | `System.out.println("Hello World")` | Standard output |

## 7. Boundary Test Cases

### 7.1 Special Character Test

#### 7.1.1 Escape Characters

\*This is not italic\* \*\*This is not bold\*\* \`This is not code\` \[This is not a link\](https://example.com)

#### 7.1.2 HTML Entities

<div>HTML entity test</div>
&copy; 2024 Copyright
&trade; Trademark symbol
& " '

### 7.2 Extreme Format Test

**Bold text with _italic_ text** _Italic text with **bold** text_ ~~Strikethrough text with **bold** text~~

### 7.3 Link Nesting Test

- [Link with `code`](https://example.com)
- [Link with **bold**](https://example.com)
- [Link with _italic_](https://example.com)

## 8. Summary

This document contains rich Markdown structures and content for comprehensive testing of Markdown parser performance. By parsing this document containing various complex elements, we can effectively evaluate the parser's performance in real-world application scenarios.

### 8.1 Test Points Summary

1. **Parsing Speed**: Document size is approximately 1MB, contains large amounts of complex structures
2. **Memory Usage**: Requires processing large amounts of nested structures and formatted content
3. **Feature Completeness**: Tests support for various Markdown extended syntax
4. **Error Handling**: Includes boundary cases and special character tests

### 8.2 Performance Metrics

- Total document characters: ~15,000 characters
- Maximum heading level: 6 levels
- Number of tables: 10
- Number of code blocks: 15
- Maximum list nesting level: 10 levels
- Number of images: 5
- Number of links: 20

---

_This document was generated in 2024, specifically for Markdown parser performance testing._
