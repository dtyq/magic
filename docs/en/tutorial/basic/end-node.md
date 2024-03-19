# End Node

The End Node is used to terminate a flow execution. It's the final node in your flow and marks the completion of the process.

## Overview

The End Node is used to properly close a flow execution, ensuring all resources are cleaned up and the process is terminated correctly.

## Configuration

### Basic Settings

- **Name**: A unique identifier for the node
- **Description**: Optional description of the node's purpose
- **Type**: Set to "End" (read-only)

### End Settings

1. **Completion Status**
   - Success
   - Failure
   - Custom Status

2. **Cleanup Options**
   - Resource Cleanup
   - Connection Closures
   - Cache Clearing

3. **Logging Options**
   - Execution Summary
   - Performance Metrics
   - Error Details

## Usage Examples

### Basic End Node

```javascript
// Example End Node configuration
{
  "type": "end",
  "config": {
    "status": "success",
    "cleanup": true,
    "logging": {
      "summary": true,
      "metrics": true
    }
  }
}
```

### Error End Node

```javascript
// Example End Node configuration for error handling
{
  "type": "end",
  "config": {
    "status": "failure",
    "errorCode": "${context.error.code}",
    "errorMessage": "${context.error.message}",
    "cleanup": true,
    "logging": {
      "summary": true,
      "errorDetails": true
    }
  }
}
```

## Best Practices

1. **Resource Management**
   - Clean up all resources
   - Close all connections
   - Clear temporary data

2. **Error Handling**
   - Log error details
   - Set appropriate status
   - Include error context

3. **Performance Monitoring**
   - Log execution time
   - Track resource usage
   - Monitor completion status

## Common Issues

1. **Resource Leaks**
   - Verify cleanup execution
   - Check connection closures
   - Monitor resource usage

2. **Incomplete Termination**
   - Check for hanging processes
   - Verify cleanup completion
   - Monitor system resources

## Related Nodes

- [Start Node](./start-node.md)
- [Reply Node](./reply-node.md)
- [Wait Node](./wait-node.md) 