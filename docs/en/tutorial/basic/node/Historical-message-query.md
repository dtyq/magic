# Historical Message Query Node

## What is a Historical Message Query Node?
The Historical Message Query Node is a functional node in Magic Flow used for retrieving historical conversation records. It acts like an intelligent memory bank that helps you extract important information from past conversations, enabling quick querying and analysis of historical interaction content.

**Image Description:**

The Historical Message Query Node interface shows the main configuration area of the node, including the maximum record count setting area and time range filtering area. The maximum count is set to 10 records by default, and the time range can be customized by selecting start and end dates. The bottom output area shows that query results will include the historical message list (history_messages), message roles (role), and message content (content).
![Historical Message Query Node](https://cdn.letsmagic.cn/static/img/Historical-message-query.png)

## Why Do We Need Historical Message Query Node?
In intelligent dialogue systems, understanding context and historical interactions is key to providing coherent, personalized service. The Historical Message Query Node helps you:
1. **Trace Conversation Flow**: Quickly retrieve previous communication content to understand the current conversation context
2. **Extract Key Information**: Find important information already provided by users from historical records, avoiding repeated inquiries
3. **Analyze User Habits**: Understand user preferences and behavior patterns through historical interaction records
4. **Enable Continuous Dialogue**: Build coherent interaction experiences based on historical conversations, improving user satisfaction

## Application Scenarios
### Scenario 1: Personalized Customer Service Bot
Customer service bots need to understand users' previous inquiries and solutions provided to avoid repeating answers or giving contradictory information. Through the Historical Message Query Node, the system can retrieve users' previous consultation records to provide a coherent service experience.

### Scenario 2: Learning Assistant Memory Function
In educational applications, learning assistants need to remember students' previous learning content and questions. The Historical Message Query Node can help retrieve students' previous learning records to provide a basis for personalized learning recommendations.

### Scenario 3: Context Management in Multi-turn Dialogues
In complex multi-turn dialogue scenarios, conversation content may span multiple topics. The Historical Message Query Node can help extract historical dialogue segments on specific topics, maintaining conversation coherence and context integrity.

## Node Parameter Description
### Input Parameters
The input parameters of the Historical Message Query Node are used to set query conditions, mainly including:
|Parameter Name|Description|Required|Default Value|
|---|---|---|---|
|Maximum Count|Limit the number of historical message records returned|Yes|10|
|Time Range Filter|Set query time interval, including start date and end date|No|None|

### Output Parameters
Query results will be available as node output parameters for use in subsequent nodes:
|Parameter Name|Description|Data Type|
|---|---|---|
|Historical Messages (history_messages)|List of historical message records|Array|
|Role (role)|Message sender role (e.g., user, system)|String|
|Content (content)|Message content|String|

## Usage Instructions
### Basic Configuration Steps
1. **Add Node**: Drag the Historical Message Query Node into the workflow editor
2. **Set Maximum Count**: Enter the number of historical messages to query in the "Maximum Count" input box (recommend setting a reasonable value, such as 10-20 records)
3. **Set Time Range** (optional): If time filtering is needed, click the time range selector to set start and end dates
4. **Connect Nodes**: Connect the Historical Message Query Node with preceding nodes (such as start or trigger nodes) and subsequent nodes (such as large model call nodes)

### Advanced Tips
1. **Precise Time Control**: For scenarios requiring high-precision time filtering, you can set exact time ranges to get conversation records from specific time periods
2. **Use with Variables**: You can save the `history_messages` from query results to variables for use in subsequent nodes
3. **Combine with Large Model Nodes**: Use historical message query results as input for large model call nodes to achieve intelligent responses based on historical conversations

## Important Notes
### Performance Considerations
- **Query Quantity Limit**: Setting too large a historical message count may reduce workflow execution efficiency; recommend setting a reasonable maximum count based on actual needs
- **Time Range Setting**: Too large a time range may return too many irrelevant messages, affecting subsequent analysis efficiency

### Content Security
- **Sensitive Information Handling**: Historical messages may contain sensitive information; consider information security when passing query results to subsequent nodes
- **Data Usage Compliance**: Ensure the use of historical messages complies with privacy protection regulations

## Common Issues
### Empty Query Results
**Problem**: Configured the Historical Message Query Node but getting empty results.
**Solutions**:
1. Check if time range settings are correct, ensure there are conversation records within the query time period
2. Confirm if preceding nodes correctly passed session information
3. Consider relaxing query conditions, such as expanding time range or increasing maximum count

### Incomplete Query Results
**Problem**: Query results are missing some expected historical messages.
**Solutions**:
1. Increase maximum count setting to ensure retrieving enough historical records
2. Check time range settings to ensure coverage of all needed historical message time periods
3. Confirm if historical messages are correctly stored in the system

## Common Paired Nodes
|Node Type|Pairing Description|
|---|---|
|Large Model Call Node|Provide historical messages to large models for context-based intelligent responses|
|Conditional Branch Node|Make decisions based on historical message content, choose different processing paths|
|Code Execution Node|Perform deep analysis and processing of historical messages|
|Message Reply Node|Build reply content based on historical analysis results| 