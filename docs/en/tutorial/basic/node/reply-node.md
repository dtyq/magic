# Message Reply Node

## What is a Message Reply Node?
The Message Reply Node is a basic node used to send information to users. When used in conjunction with large model nodes, it can also achieve streaming reply effects. It supports multiple message types, including plain text, Markdown formatted text, and various attachments (images, audio, video, files), allowing flexible information exchange with users.

**Image Description:**

The Message Reply Node interface mainly consists of a message type selection area and a content editing area. At the top, you can select the message type to send (text, Markdown, image, etc.), and the content editing area below will display corresponding configuration options based on the selected type, such as text editing boxes or attachment link input fields. Here you can configure the specific content to send to users.

![Message Reply Node](https://cdn.letsmagic.cn/static/img/reply-node-1.png)

![Message Reply Node Types](https://cdn.letsmagic.cn/static/img/reply-node-2.png)

![Message Reply Node Types](https://cdn.letsmagic.cn/static/img/reply-node-3.png)

## Why Do We Need a Message Reply Node?
When building intelligent workflows, the Message Reply Node solves the following key problems:
1. **Information Transmission**: Conveys workflow processing results, status, or prompt information to users, maintaining interaction continuity.
2. **Diversified Expression**: Through support for multiple message types (text, Markdown, attachments, etc.), makes reply content more diverse and enhances user experience.
3. **Structured Display**: Uses Markdown format to create rich text effects like tables, lists, bold, italic, etc., making information more organized and easier to understand.
4. **Professional Content Sharing**: Shares professional content like images and documents through attachment functionality, meeting complex business scenario needs.

## Application Scenarios
### 1. User Q&A Replies
When users ask questions to the AI assistant, the Message Reply Node can send accurate, detailed text answers, providing users with the information they need. This is the most basic and common application scenario.
### 2. Structured Data Display
When needing to display structured data like tables and lists to users, you can use Markdown format to write content, such as displaying query results, product lists, task lists, etc.
### 3. File and Document Sharing
When users need to obtain files and documents like images, they can be sent as attachments, such as sharing product manuals, technical documentation, spreadsheets, etc.

## Node Parameter Description
### Basic Parameters
|Parameter Name|Description|Data Type|Required|Default Value|
|---|---|---|---|---|
|Message Type|Specifies the type of message to send|Selector|Yes|Text|
|Content|Specific text content of the message|String|Depends on message type|None|
|Attachment Link|Access link for the attachment|String|Required for attachment types|None|
|Attachment Name|Display name for the attachment|String|Required for attachment types|None|

### Message Type Description
The Message Reply Node supports the following message types:
1. **Text**: Plain text messages, suitable for simple text replies
2. **Markdown**: Formatted text supporting styles like headings, lists, tables
3. **Image**: Sending image attachments
4. **Video**: Sending video attachments
5. **Audio**: Sending audio attachments
6. **File**: Sending general file attachments

### Input Description
The Message Reply Node's input mainly comes from the processing results of previous nodes in the workflow:
1. **Variable References**: Can use `${variable_name}` format in content fields to reference variables in the workflow
2. **Dynamic Content**: Supports referencing large model call results, conditional judgment results, etc.
3. **Attachment Paths**: Can reference document parsing nodes, HTTP request nodes, etc. for generated attachment paths

### Output Description
The Message Reply Node has no standard output content, depending on the message type set on the node

## Usage Instructions
### Basic Configuration Steps
1. **Add Message Reply Node**:
    1. Drag "Message Reply" node from the node panel to the canvas
    2. Connect the previous node to the Message Reply node
2. **Select Message Type**:
    1. Click the node, select the message type to send in the right property panel
    2. Choose appropriate type based on business needs (text, Markdown, image, etc.)
3. **Configure Message Content**:
    1. For text and Markdown types: Enter text to send in the "Content" field
    2. For attachment types (image, audio, video, file):
        1. Enter attachment URL in "Attachment Link" field
        2. Enter attachment display name in "Attachment Name" field
4. **Use Variable References**:
    1. Use `${variable_name}` format in content fields to reference workflow variables
    2. Example: `Hello, ${user_name}! Your query result is: ${query_result}`
5. **Save and Connect Next Node**:
    1. Save configuration and connect to next node as needed
    2. If it's the last step of the process, can connect to end node

### Advanced Techniques
#### Markdown Formatting Tips
Using Markdown format can make your messages more structured and beautiful:
1. **Heading Levels**: Use `#`, `##`, `###` to create different level headings
2. **List Formats**: Use `-` or `1.` to create unordered or ordered lists
3. **Table Creation**: Use `|` and `-` combination to create table structures
4. **Text Emphasis**: Use `**text**` for bold or `*text*` for italic
5. **Link Insertion**: Use `[link text](URL)` format to insert links

Example Markdown content:
```
## Query Results

Your query results are as follows:

| Item | Status | Completion |
|-----|------|-------|
| Task A | In Progress | 75% |
| Task B | Completed | 100% |

Please click [here](https://example.com) to view detailed report.
```

#### Dynamic Content Generation
Combining with other nodes can generate more dynamic and personalized reply content:
1. **Combine with Large Model Calls**: Reference content generated by large models for intelligent replies
2. **Combine with Conditional Branches**: Dynamically determine reply content based on different conditions
3. **Combine with Code Execution**: Use code to process data and generate formatted content
4. **Combine with HTTP Requests**: Display data obtained from external APIs

## Notes
### Content Length Limits
1. **Text Length**: Single message text content should not be too long, recommended to keep within 5000 characters
2. **Segmented Sending**: For very long content, consider using multiple Message Reply nodes to send in segments
3. **Avoid Spamming**: Don't send large numbers of messages in short time periods, may affect user experience

### Attachment Usage Guidelines
1. **File Size**: Attachments should be moderate in size, overly large files may cause slow loading
2. **Link Validity**: Ensure attachment links are valid and have sufficient access permissions
3. **File Format**: Ensure sent files are in common, easily opened formats
4. **Naming Convention**: Attachment names should be concise and clear, expressing file content

### Variable Reference Notes
1. **Variable Existence**: Ensure referenced variables are defined and have values in the workflow
2. **Variable Type**: Pay attention to variable data types, non-string types may need conversion
3. **Null Value Handling**: Consider cases where variables may be null, set default values when necessary
4. **Escape Characters**: Use backslash to escape `${}` characters if needed in text

## Common Issues
### Why isn't my Markdown format displaying correctly?
1. **Syntax Error**: Check if Markdown syntax is correct, especially for structures like tables and lists
2. **Client Support**: Confirm if target client fully supports Markdown format
3. **Special Characters**: Some special characters may need escaping, like `*`, `_`, `#`
4. **Empty Line Handling**: Ensure paragraphs have empty lines between them, list items don't have empty lines

### How to insert dynamically generated images in replies?
1. **Use HTTP Request Node**: Get or generate images, obtain image URL
2. **Store URL in Variable**: Store image URL in a variable
3. **Switch to Image Type**: Select "Image" type in Message Reply node
4. **Reference URL Variable**: Reference URL variable in attachment link field

### How to handle message sending failures?
1. **Add Error Handling**: Add conditional branch after Message Reply node to check sending status
2. **Set Retry Mechanism**: Consider adding retry logic for important messages
3. **Log Errors**: Use code execution node to record failure reasons
4. **Alternative Notification Channels**: Configure alternative notification methods to ensure information delivery 