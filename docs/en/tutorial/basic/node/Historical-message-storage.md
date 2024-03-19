# Historical Message Storage Node

## What is a Historical Message Storage Node?
The Historical Message Storage Node is a functional node in Magic Flow workflow used for recording and saving conversation messages. It acts like a memory storage unit that can save specified text information into the conversation history for subsequent queries and usage. These stored messages can be retrieved in subsequent interactions, providing conversation memory capability for AI assistants.

**Image Description:**

The top area is for message type selection, currently supporting text, image, and file card type messages; the bottom area is for message content input, supporting the use of "@" to add variables for dynamic content storage.
![Historical Message Storage Node](https://cdn.letsmagic.cn/static/img/Historical-message-storage.png)

## Why Do We Need Historical Message Storage Node?
In intelligent dialogue systems, memory and context management are key to providing a coherent interaction experience. The Historical Message Storage Node helps you:
1. **Build AI Assistant Memory**: Let AI assistants "remember" important information without requiring users to repeat it
2. **Save Intermediate Results**: Store key data and intermediate results from the workflow for subsequent processes to reference
3. **Maintain Conversation Coherence**: Ensure conversation continuity and context awareness by storing contextual information
4. **Create User Profiles**: Record key information provided by users to gradually build user profiles for personalized experiences

## Application Scenarios
### Scenario 1: User Information Collection and Memory
After users provide personal information (such as name, preferences, etc.) for the first time, the Historical Message Storage Node can be used to record this information. In subsequent conversations, the system can directly use these memories, avoiding repeated inquiries and improving user experience.

### Scenario 2: Multi-turn Dialogue Memory Management
In complex multi-turn dialogue scenarios, certain key information needs to be used across multiple conversation rounds. Through the Historical Message Storage Node, important content can be selectively saved, rather than just relying on automatically remembered recent messages.

### Scenario 3: Workflow Status Recording
In scenarios like handling work orders and approvals, the Historical Message Storage Node can be used to record the status and results of each step, forming complete processing records for subsequent queries and tracking.

## Node Parameter Description
### Input Parameters
**The main input parameters of the Historical Message Storage Node include:**
|Parameter Name|Description|Required|Default Value|
|---|---|---|---|
|Message Type|Currently supports text, image, and file card type messages|Yes|Text|
|Message Content|Text information to be stored, supports variable references|Yes|None|

### Output Content
The Historical Message Storage Node has no standard output parameters; its main function is to write content into the system's historical message records.

## Usage Instructions
### Basic Configuration Steps
1. **Add Node**: Drag the Historical Message Storage Node into the workflow editor
2. **Select Message Type**: Choose "Text" from the message type dropdown menu
3. **Write Message Content**: Enter the text to be stored in the message content input box
    1. Can directly input fixed text, such as "User preferences recorded"
    2. Can also reference variables using the "@" symbol, such as "User preference: @user_preference"
4. **Connect Nodes**: Connect the Historical Message Storage Node with preceding nodes (such as conditional branches or code execution nodes) and subsequent nodes

### Advanced Tips
1. **Combined Variable Usage**: Message content supports multiple variable combinations to build structured memory content
2. **Use Conditional Filtering**: Work with conditional branch nodes to store information only when specific conditions are met
3. **Format Storage Content**: Use well-formatted text templates for easier subsequent retrieval and processing

## Important Notes
### Storage Quantity Limitations
- **Store Moderately**: Don't store too much unnecessary information, which may lead to overly lengthy historical records
- **Focus on Key Points**: Only store key information valuable for subsequent interactions to improve storage efficiency

### Content Security
- **Sensitive Information Handling**: Avoid storing user privacy and sensitive information, such as passwords, detailed contact information, etc.
- **Compliant Usage**: Ensure stored content complies with data privacy regulations

### Content Format
- **Clear Structure**: Design structured storage formats for easier subsequent retrieval and understanding
- **Length Control**: Overly long content may be difficult to process in subsequent queries, recommend controlling reasonable length

## Common Issues
### Cannot Find Stored Content in Subsequent Processes
**Solutions**:
1. Confirm the workflow execution order is correct; storage nodes must execute before query nodes
2. Check the time range settings of historical message query nodes to ensure they cover the time point of stored messages
3. Increase the maximum number of records setting in historical message query nodes to ensure coverage of stored messages

### Stored Variable Content is Incorrect
**Solutions**:
1. Check if variable references are correct, ensure using correct variable names
2. Verify if preceding nodes successfully output expected variable values
3. Use code execution nodes to print variable content for debugging, confirm correct variable transmission in the workflow

## Common Paired Nodes
|Node Type|Pairing Description|
|---|---|
|Historical Message Query Node|Use storage and query together for complete memory management|
|Large Model Call Node|Provide stored historical information to large models to enhance context understanding|
|Conditional Branch Node|Decide whether to store specific information based on conditions|
|Code Execution Node|Process and format content to be stored| 