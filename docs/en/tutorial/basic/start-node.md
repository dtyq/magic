# Start Node

The Start Node is the entry point of any flow in Magic. It defines how your flow begins and what initial data it receives.

## Overview

The Start Node is the first node in your flow and cannot be connected to any other nodes from its input side. It can only have outgoing connections.

## Configuration

### Basic Settings

- **Name**: A unique identifier for the node
- **Description**: Optional description of the node's purpose
- **Type**: Set to "Start" (read-only)

### Input Parameters

The Start Node can be configured to accept various types of input:

1. **HTTP Request**
   - Method (GET, POST, PUT, DELETE)
   - Headers
   - Query Parameters
   - Body

2. **Webhook**
   - URL
   - Authentication
   - Payload Format

3. **Schedule**
   - Cron Expression
   - Time Zone
   - Repeat Options

## Usage Examples

### HTTP Endpoint

```javascript
// Example Start Node configuration for HTTP endpoint
{
  "type": "start",
  "config": {
    "method": "POST",
    "path": "/api/process",
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
```

### Scheduled Task

```javascript
// Example Start Node configuration for scheduled task
{
  "type": "start",
  "config": {
    "schedule": "0 0 * * *",  // Run daily at midnight
    "timezone": "UTC"
  }
}
```

## Best Practices

1. **Naming Convention**
   - Use descriptive names that indicate the purpose
   - Include the trigger type in the name (e.g., "HTTP_Start", "Schedule_Start")

2. **Error Handling**
   - Always validate input data
   - Include appropriate error responses
   - Log important events

3. **Security**
   - Implement proper authentication
   - Validate input data
   - Use HTTPS for HTTP endpoints

## Common Issues

1. **Invalid Configuration**
   - Check method and path for HTTP endpoints
   - Verify cron expression for scheduled tasks
   - Ensure all required fields are filled

2. **Connection Issues**
   - Verify network connectivity
   - Check firewall settings
   - Validate SSL certificates

## Related Nodes

- [Reply Node](./reply-node.md)
- [Wait Node](./wait-node.md)
- [End Node](./end-node.md) 