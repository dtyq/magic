# Wait Node

The Wait Node is used to pause the execution of a flow for a specified duration or until a specific condition is met.

## Overview

The Wait Node allows you to control the timing of your flow execution, which is useful for rate limiting, polling, or coordinating with external systems.

## Configuration

### Basic Settings

- **Name**: A unique identifier for the node
- **Description**: Optional description of the node's purpose
- **Type**: Set to "Wait" (read-only)

### Wait Settings

1. **Wait Type**
   - Fixed Duration
   - Until Condition
   - Until Time
   - Until Event

2. **Duration Settings**
   - Time Value
   - Time Unit (seconds, minutes, hours)
   - Random Range (optional)

3. **Condition Settings**
   - Expression
   - Timeout
   - Retry Options

## Usage Examples

### Fixed Duration Wait

```javascript
// Example Wait Node configuration for fixed duration
{
  "type": "wait",
  "config": {
    "waitType": "duration",
    "duration": 30,
    "unit": "seconds"
  }
}
```

### Conditional Wait

```javascript
// Example Wait Node configuration for conditional wait
{
  "type": "wait",
  "config": {
    "waitType": "condition",
    "condition": "${context.data.status} === 'ready'",
    "timeout": 300,
    "retryInterval": 10
  }
}
```

## Best Practices

1. **Timeout Handling**
   - Set appropriate timeouts
   - Handle timeout scenarios
   - Log timeout events

2. **Resource Management**
   - Avoid excessive wait times
   - Use appropriate intervals
   - Monitor system resources

3. **Error Handling**
   - Handle condition evaluation errors
   - Log wait events
   - Provide fallback behavior

## Common Issues

1. **Timeout Issues**
   - Check condition syntax
   - Verify timeout values
   - Monitor system load

2. **Resource Exhaustion**
   - Limit concurrent waits
   - Use appropriate intervals
   - Monitor system resources

## Related Nodes

- [Start Node](./start-node.md)
- [Reply Node](./reply-node.md)
- [End Node](./end-node.md) 