# Cloud Document Parsing Node
## What is a Cloud Document Parsing Node?
The Cloud Document Parsing Node is a functional module specifically designed for reading and processing Markdown documents stored in the cloud. It helps you directly access and use internal knowledge documents within your workflow, without the need to manually copy and paste document content. Through this node, you can automatically load document content into your workflow for subsequent processing and analysis by other nodes.

**Image Description:**

The configuration interface of the Cloud Document Parsing Node includes a document selection area, where you can specify the cloud document to be parsed using a selector.
![Cloud Document Parsing Node](https://cdn.letsmagic.cn/static/img/Cloud-document-parsing.png)

## Why do you need a Cloud Document Parsing Node?
When building intelligent workflows, we often need to reference, analyze, or process existing document materials within the enterprise. The Cloud Document Parsing Node solves the following problems:
1. **Automated Information Acquisition**: Automatically read cloud documents without manual copying of document content
2. **Knowledge Integration**: Seamlessly integrate enterprise internal knowledge bases with intelligent workflows
3. **Real-time Information Updates**: When cloud documents are updated, workflows can read the latest content, maintaining information timeliness
4. **Structured Processing**: Convert Markdown documents into processable data structures for use by subsequent nodes

## Application Scenarios
### Scenario One: Knowledge Base Q&A System
Build an intelligent question-answering system based on internal company documents, where the system automatically extracts information from relevant documents and generates answers when users ask questions.

### Scenario Two: Document Content Analysis
Automatically analyze enterprise document content, extract key information, statistical data, or generate summary reports.

### Scenario Three: Document Content Update Notifications
Monitor changes in important documents and automatically send notifications or summaries to relevant personnel when document content is updated.

## Node Parameter Description
### Input Parameters
|Parameter Name|Description|Required|Default Value|
|---|---|---|---|
|Select File|Select the cloud document to be parsed|Yes|None|

### Output Parameters
|Parameter Name|Description|Data Type|
|---|---|---|
|Document Content (content)|Parsed document text content|String|

## Usage Instructions
### Basic Configuration Steps
1. **Add Cloud Document Parsing Node**: Drag the "Cloud Document Parsing" node from the node panel to the workflow canvas
2. **Select Document**:
    1. Method One: Directly select the cloud document to be parsed from the dropdown menu
3. **Connect Subsequent Nodes**: Connect the output of the Cloud Document Parsing Node to subsequent processing nodes

### Advanced Techniques
1. **Dynamic Document Selection**: Use variables to pass in document IDs, allowing dynamic selection of different documents based on user input or other conditions
2. **Document Content Extraction**: In combination with code nodes, you can extract specific parts of content from documents
3. **Multi-document Processing**: Through loop nodes, you can batch process multiple cloud documents
4. **Content Comparison**: In combination with code nodes, you can compare content differences between different document versions

## Precautions
### Document Access Permissions
Ensure that the workflow executor has access permissions to the selected cloud documents, otherwise document content cannot be successfully obtained.

### Document Size Limitations
Parsing extremely large documents may affect workflow execution efficiency; it is recommended to first split or extract key parts from large documents.

### Markdown Format Support
The node supports standard Markdown syntax, but certain special formats or custom syntax may not parse correctly.

### Real-time Considerations
The node retrieves document content at the time of execution; if documents are frequently updated, caching strategies may need to be considered.

## Frequently Asked Questions
### Question One: Document Content Cannot Be Correctly Displayed or Parsed

**Solution**:
- Check if the document format is standardized, avoid using overly complex Markdown syntax
- Confirm that the document does not contain special characters or encoding issues
- Check if document access permissions are correctly set

### Question Two: How to Handle Images and Attachments in Documents?

**Solution**:
- The Cloud Document Parsing Node by default only extracts text content, not including images
- If you need to process images, you can use the HTTP Request Node to separately obtain image resources
- For attachments, a separate file access API is needed

### Question Three: How to Handle Formatted Table Data?

**Solution**:
- Markdown tables will be parsed as text form
- If you need to convert tables to structured data, you can use code nodes for processing afterwards
- For complex tables, consider using the Spreadsheet Parsing Node instead

## Common Node Combinations
|**Node Type**|**Combination Reason**|
|---|---|
|Large Model Call Node|Pass parsed document content to the large model to generate summaries, answer questions, or extract key information|
|Text Segmentation Node|Split long documents into small paragraphs for further processing|
|Code Node|Perform format conversion, data extraction, or custom processing on document content|
|Knowledge Retrieval Node|Combined with vector search, implement intelligent Q&A based on document content| 