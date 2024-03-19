# Reply Node

The Reply Node is used to send responses back to users or external systems. It's typically used at the end of a flow or before the End Node.

## Overview

The Reply Node handles the output of your flow, formatting and sending data in the appropriate format to the recipient.

## Configuration

### Basic Settings

- **Name**: A unique identifier for the node
- **Description**: Optional description of the node's purpose
- **Type**: Set to "Reply" (read-only)

### Response Settings

1. **Response Format**
   - JSON
   - XML
   - Plain Text
   - HTML
   - Custom Format

2. **Response Headers**
   - Content-Type
   - Status Code
   - Custom Headers

3. **Response Body**
   - Static Content
   - Dynamic Content (using expressions)
   - Template-based Content

## Usage Examples

### JSON Response

```javascript
// Example Reply Node configuration for JSON response
{
  "type": "reply",
  "config": {
    "format": "json",
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "status": "success",
      "data": "${context.processedData}"
    }
  }
}
```

### HTML Response

```javascript
// Example Reply Node configuration for HTML response
{
  "type": "reply",
  "config": {
    "format": "html",
    "statusCode": 200,
    "headers": {
      "Content-Type": "text/html"
    },
    "body": "<html><body><h1>${context.title}</h1><p>${context.message}</p></body></html>"
  }
}
```

## Best Practices

1. **Response Formatting**
   - Use appropriate content types
   - Format data consistently
   - Include error details when needed

2. **Error Handling**
   - Set appropriate status codes
   - Include error messages
   - Log error details

3. **Performance**
   - Minimize response size
   - Use compression when appropriate
   - Cache responses when possible

## Common Issues

1. **Format Errors**
   - Check JSON/XML syntax
   - Validate template expressions
   - Verify content type headers

2. **Response Delays**
   - Optimize data processing
   - Check network latency
   - Monitor response times

## Related Nodes

- [Start Node](./start-node.md)
- [Wait Node](./wait-node.md)
- [End Node](./end-node.md) 