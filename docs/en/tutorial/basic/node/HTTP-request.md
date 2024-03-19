# HTTP Request Node
## What is an HTTP Request Node?
The HTTP Request Node is an important node in the Magic Flow workflow used for interacting with external APIs and network services. It acts like a bridge connecting your workflow with the external world, allowing you to send various network requests (such as GET, POST, etc.), obtain external data, or submit information to external systems. Through this node, you can easily integrate external services and data sources into your intelligent applications.

**Image Description:**

The HTTP Request Node interface includes configuration areas for request URL, request method, request headers, and request body, as well as response parsing and output settings sections. Through these configurations, users can define how to interact with external APIs.
![HTTP Request Node](https://cdn.letsmagic.cn/static/img/HTTP-request.png)

## Why do you need an HTTP Request Node?
When building intelligent applications, you often need to obtain external data or interact with other systems. The HTTP Request Node is designed for this purpose:
- **Get Real-time Data**: Obtain the latest information from external APIs, such as weather forecasts, exchange rates, stock quotes, etc.
- **System Integration**: Connect with internal enterprise or third-party systems to achieve cross-system data exchange
- **Trigger External Services**: Call external services to complete specific functions, such as sending SMS, push notifications, etc.
- **Data Submission**: Submit form data or other information to external systems
- **Authentication**: Connect with third-party authentication services, such as OAuth authentication

## Application Scenarios
### 1. Data Aggregation Applications
Create an application that summarizes information from multiple data sources, such as integrating sales data from different platforms into a single report to provide a comprehensive view for decision-making.

### 2. Integration with Internal Enterprise Systems
Integrate Magic Flow workflows with internal enterprise systems (such as CRM, ERP, OA, etc.) to achieve data flow and business collaboration.

### 3. Enhanced Intelligent Assistants
Enhance the capabilities of intelligent assistants by calling specialized APIs (such as weather APIs, translation APIs, etc.), providing richer services.

### 4. Trigger and Notification Systems
Build systems that can monitor specific events and trigger notifications, such as inventory warnings, price fluctuation alerts, etc.

## Node Parameter Description
### Basic Parameters
|Parameter Name|Description|Required|Default Value|
|---|---|---|---|
|Request URL|Specify the target address of the request|Yes|None|
|Request Method|Choose the HTTP request method (GET/POST/PUT/DELETE, etc.)|Yes|GET|
|Request Headers|Set HTTP request header information, such as Content-Type, Authorization, etc.|No|None|
|Request Body|When using POST/PUT and other methods, set the data to be sent|No|None|

#### Query Parameters (Query)
Query parameters are attached to the URL in the form of key-value pairs, in the format `?key1=value1&key2=value2`
|Configuration Item|Description|
|---|---|
|Parameter Name|Name of the query parameter|
|Parameter Type|Data type of the parameter, such as string, number, etc.|
|Parameter Value|The specific value of the parameter, supports variable references|

#### Path Parameters (Path)
Path parameters are the dynamic parts in the URL path, commonly used in APIs, such as `/user/{id}`
|Configuration Item|Description|
|---|---|
|Parameter Name|Name of the path parameter|
|Display Name|The parameter name displayed on the interface|
|Parameter Type|Data type of the parameter|
|Parameter Value|The specific value of the parameter, supports variable references|

#### Request Body (Body)
The request body is used to send data in POST, PUT, and other requests
|Configuration Item|Description|
|---|---|
|Content Type|Format of the request body, such as JSON, Form, etc.|
|Request Body Content|The specific content of the request body, with different editing methods based on the content type|

#### Request Headers (Headers)
Request headers are used to send metadata for HTTP requests
|Configuration Item|Description|
|---|---|
|Parameter Name|Name of the request header|
|Display Name|The parameter name displayed on the interface|
|Parameter Type|Data type of the parameter|
|Parameter Value|The specific value of the parameter, supports variable references|

### Output Settings
|Configuration Item|Description|
|---|---|
|System Output|The response result of the HTTP request is automatically stored in the system output|
|Custom Output|Specific parts of the response result can be extracted as custom variables|

## Usage Instructions
### Basic Configuration Steps
1. **Set Request URL**:
    1. Enter the complete API address, including the protocol ([http:// or https://](http://or https://))
    2. Dynamic URLs can be referenced using variables, such as `https://api.example.com/users/{{user_id}}`
2. **Select Request Method**:
    1. GET: Used to retrieve data, such as querying information
    2. POST: Used to submit data, such as creating records
    3. PUT: Used to update data, such as updating user information
    4. DELETE: Used to delete data
3. **Configure Request Headers**:
    1. Set Content-Type (such as application/json, multipart/form-data, etc.)
    2. Add authentication information, such as Authorization: Bearer token
    3. Other necessary header information such as Accept, User-Agent, etc.
4. **Write Request Body (applicable for POST/PUT and other methods)**:
    1. For JSON format, you can use the JSON editor
    2. Variables can be referenced, such as `{"name": "{{user_name}}", "age": {{user_age}}}`
5. **Configure Response Parsing**:
    1. Select the appropriate response format (JSON, XML, Text, etc.)
    2. Set the extraction path for response data (if needed)

### Advanced Techniques
#### JSON Data Processing
Handling JSON format APIs is the most common scenario:
1. **Sending JSON Data**:
    1. Set Content-Type to application/json
    2. Use the correct JSON format in the request body
1. **Handling JSON Responses**:
    1. Choose JSON response parsing method
    2. Specific fields can be extracted via JSON path, such as `response.data.items`
2. **Handling Nested Data**:
    1. For complex nested JSON, further processing can be done in subsequent nodes (such as the Code Execution Node)

#### Authentication and Security
Interacting with external APIs usually requires authentication:
1. **Basic Authentication**:
    1. Use Authorization header: `Basic base64(username:password)`
    2. Can be configured directly in the request headers
2. **OAuth Authentication**:
    1. Obtain an access token (may require a separate HTTP Request Node)
    2. Use in the Authorization header: `Bearer your_access_token`
3. **API Key Authentication**:
    1. Depending on API requirements, keys may be added to URL query parameters, request headers, or request body
    2. Example: `https://api.example.com/data?api_key=your_api_key`

## Precautions
### Timeout and Performance
External API calls may cause workflow execution delays:
- Set reasonable timeout times for important or potentially slow API calls
- Configure appropriate retry counts for unstable APIs
- Consider using asynchronous mode for long-running requests

### Error Handling
Network requests may fail for various reasons:
- Configure proper error handling mechanisms, such as conditional branch judgment of response status
- Check error output fields for detailed error information
- Add fallback mechanisms for critical processes, such as alternatives when APIs are unavailable

### Data Security
Considerations when handling sensitive data:
- Avoid including sensitive information (such as passwords) in URLs, use request headers or request body instead
- Use HTTPS protocol to ensure encrypted data transmission
- Consider using environment variables or key management systems to store sensitive information like API keys

## Frequently Asked Questions
### Question 1: How to handle API rate limiting issues?
**Solution**: Many APIs have call frequency limits, you can:
- Implement request rate control to avoid sending too many requests in a short time
- Properly handle 429 (Too Many Requests) status codes, add waiting logic
- Consider data caching to reduce the number of API calls when conditions allow

### Question 2: What to do if the returned data format is incorrect?
**Solution**: When the data format does not meet expectations:
- Check if the response parsing method is correct (JSON/XML/Text)
- Use the Code Execution Node to transform the data
- Confirm the API documentation, verify if the request parameters are correct

### Question 3: How to transfer files or binary data?
**Solution**: Transferring files requires special handling:
- Set Content-Type to multipart/form-data
- Use the correct request body format to encapsulate file data
- For large files, pay attention to request timeout settings

## Common Node Combinations
|Node Type|Combination Reason|
|---|---|
|Code Execution Node|Process response data, convert format, or extract key information|
|Conditional Branch Node|Decide the next step based on API response status or content|
|Large Model Call Node|Provide API-obtained data as context to the large model|
|Variable Saving Node|Save key data returned by the API for use in subsequent processes|
|Loop Node|Handle paginated APIs or batch requests for multiple resources| 