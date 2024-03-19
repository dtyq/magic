# Text Segmentation Node
## What is a Text Segmentation Node?
The Text Segmentation Node is a special data processing node in the Magic workflow, mainly used to split long text into smaller text fragments according to specific strategies. This node is particularly useful when processing large amounts of text data, as it can divide overly long text content into smaller chunks suitable for large model processing, improving efficiency and accuracy.

**Image Description:**

The Text Segmentation Node interface mainly consists of input and output areas. In the input area, you can specify the text content to be segmented or reference variables; in the output area, you can select the output format and set the result variable name.
![Text Segmentation Node](https://cdn.letsmagic.cn/static/img/Text-segmentation.png)

## Why do you need a Text Segmentation Node?
When processing large amounts of text, the entire block of text is often too large for precise analysis and processing. The Text Segmentation Node solves this problem:
1. **Large Model Processing Limitations**: Large language models usually have input character count limitations, and segmentation allows batch processing
2. **Fine-grained Processing**: Breaking long text into small fragments facilitates precise processing of specific content
3. **Improved Processing Efficiency**: Reasonable text segmentation can improve the efficiency of subsequent analysis and processing
4. **Easier Storage and Retrieval**: Segmented text fragments are more suitable for storage in vector databases and other systems, improving retrieval precision

## Application Scenarios
### Scenario 1: Long Document Knowledge Base Construction
When you need to import long documents (such as product manuals, research reports) into a knowledge base, you can first use the Text Segmentation Node to split the document into appropriately sized fragments, then import them into a vector database, which improves the precision of subsequent retrieval.

### Scenario 2: Large-scale Text Processing
When processing large-scale texts such as news reports and customer feedback, you can first segment them into paragraphs or sentences, and then analyze them one by one to extract key information or sentiment tendencies.

### Scenario 3: Conversation History Processing
When processing long-term conversation history records, you can use the Text Segmentation Node to split historical messages by time or topic, facilitating conversation flow analysis or key information extraction.

## Node Parameter Description
### Input Parameters
|Parameter Name|Description|Required|Parameter Type|Example Value|
|---|---|---|---|---|
|Long Text|The text content to be segmented, can be directly input or referenced from a variable|Yes|Text/Variable Reference|"This is a very long text content..." or @variable_name|

### Output Parameters
|Parameter Name|Description|Parameter Type|Example Value|
|---|---|---|---|
|Output Type|The output format of the segmented text, options include "Text Fragments" or "String Array"|Selection|Text Fragments|
|Output Variable Name|Set the variable name for the output result, for use by subsequent nodes|Text|split_texts|

## Usage Instructions
### Basic Configuration Steps
1. **Add Text Segmentation Node**: In the workflow editor, drag the Text Segmentation Node onto the canvas
2. **Configure Input Text**:
    1. Enter text content directly in the input box, or
    2. Click the "@" button and select a variable containing text from the dropdown menu (such as the output of a previous node)
3. **Set Output Format**:
    1. Select "Text Fragments": The output format is a standard format used internally by the system, suitable for subsequent vector searches and other operations
    2. Select "String Array": The output is a regular text array, suitable for general processing and display
4. **Set Output Variable Name**: Enter a meaningful variable name, such as "split_texts", for easy reference in subsequent nodes
5. **Connect Subsequent Nodes**: Connect the Text Segmentation Node with subsequent processing nodes to form a complete workflow

### Advanced Techniques
1. **Variable Combination Input**: Multiple variables can be combined into a long text and then segmented, for example: `@user_input + "\n\n" + @history_record`
2. **Combined with Conditional Judgment**: Set condition nodes to only perform segmentation processing when the text length exceeds a certain value
3. **Batch Processing**: Combined with loop nodes, multiple text inputs can be processed in batches

## Precautions
### Text Length Limitations
When the input text is too long, it may affect system performance. It is recommended to preprocess or import in batches for particularly long texts (such as documents exceeding 10MB).

### Segmentation Quality Impact
The quality of text segmentation directly affects the effect of subsequent processing. The system currently uses a fixed strategy for segmentation, and more segmentation strategies will be available in the future.

### Variable Naming Conventions
Set meaningful names for output variables, avoid using generic names such as "result" to prevent confusion between outputs of different nodes in complex workflows.

## Frequently Asked Questions
### Question 1: How to handle too many text fragments after segmentation?
**Solution**:
1. Consider filtering the segmented fragments to retain only important content
2. Use loop nodes to process these fragments in batches
3. Set processing limits in subsequent nodes, such as only processing the first N fragments

### Question 2: How to maintain semantic coherence when text fragments lose context association after segmentation?
**Solution**:
1. Ensure moderate granularity of segmentation, not too fine
2. In subsequent processing, consider introducing content from adjacent fragments as context
3. When using large models for processing, clearly explain the relationship between these text fragments in the prompt

## Common Node Combinations
|**Node Type**|**Combination Reason**|
|---|---|
|Document Parsing Node|Parse the document first, then perform text segmentation|
|Vector Storage Node|Store the segmented text fragments in a vector database|
|Large Model Call Node|Analyze and process the segmented text fragments|
|Loop Node|Batch process multiple text fragments after segmentation| 