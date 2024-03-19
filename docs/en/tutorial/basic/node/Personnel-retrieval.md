# Personnel Retrieval Node

## What is a Personnel Retrieval Node?
The Personnel Retrieval Node is a functional node in Magic Flow workflow specifically designed for querying and filtering organizational personnel information. It allows you to quickly locate and obtain personnel data based on multiple conditions (such as name, employee ID, position, department, etc.), much like performing precise searches in a corporate directory.

**Image Description:**

The Personnel Retrieval Node interface mainly consists of search condition setting area and output data structure preview area. The upper part shows various filter condition configuration options, including user name, employee ID, position, and other filtering conditions; the lower part displays the data structure of query results, including user basic information and department information fields.
![Personnel Retrieval Node](https://cdn.letsmagic.cn/static/img/Personnel-retrieval.png)

## Why Do We Need Personnel Retrieval Node?
In enterprise workflows, accurately obtaining personnel information is a fundamental requirement for many automated processes:
- **Data Association**: Link business data with specific responsible persons or teams
- **Access Control**: Divide information access permissions based on personnel roles or departments
- **Process Flow**: Identify handlers or approvers for next process steps
- **Message Notification**: Send automated notifications to specific personnel or teams
- **Team Collaboration**: Build intelligent collaboration processes based on organizational structure

## Application Scenarios
### 1. Intelligent Approval Process
Automatically find approvers from corresponding departments based on application content, precisely forward approval requests, improving process efficiency.

### 2. Department Information Summary
Quickly retrieve all member information of specific departments for generating department reports, team analysis, or resource allocation.

### 3. Personnel Data Linkage
When users submit requests, automatically associate their department, direct supervisor, and other information based on their identity, reducing manual input.

### 4. Intelligent Message Distribution
Automatically find relevant responsible persons based on business rules, precisely delivering system messages or work reminders to appropriate people.

## Node Parameter Description
### Search Condition Parameters
|Parameter Name|Description|Required|Default Value|
|---|---|---|---|
|User Name|Match by personnel real name|No|None|
|Employee ID|Match by personnel ID number|No|None|
|Position|Match by personnel position or job title|No|None|
|Mobile Number|Match by personnel mobile phone number|No|None|
|Department Name|Match by department name|No|None|
|Group Chat Name|Match by group chat name|No|None|

### Condition Rule Description
Each search condition supports the following rule types:
|Rule Type|Description|Example|
|---|---|---|
|Equals|Field value exactly matches specified value|Name equals "John Smith"|
|Not Equals|Field value does not equal specified value|Position not equals "Intern"|
|Contains|Field value contains specified content|Department name contains "Tech"|
|Not Contains|Field value does not contain specified content|Name not contains "Test"|
|Is Empty|Field value is empty|Mobile number is empty|
|Not Empty|Field value is not empty|Employee ID not empty|

### Value Type Settings
|Value Type|Description|Example|
|---|---|---|
|Fixed Value|Directly input specific query value|"John Smith", "R&D Dept"|
|Variable Value|Reference variables in workflow as query value|department_name|

### Output Content
|Output Field|Description|
|---|---|
|User Data (Array)|List of users matching conditions, each user includes: unique user ID, real name, position name, etc.|

## Usage Instructions
### Basic Configuration Steps
1. **Set Basic Search Conditions**:
    1. Click needed search condition (like "User Name")
    2. Select matching rule (like "Equals", "Contains", etc.)
    3. Choose value type ("Fixed Value" or "Variable Value")
    4. Input specific query value or select variable
2. **Add Multiple Search Conditions** (Optional):
    1. Click "Add Condition" button to add more filter conditions
    2. Multiple conditions default to "AND" relationship, meaning all conditions must be met
3. **View Output Fields**:
    1. Expand "Output" section to understand query result data structure
    2. Familiarize with field meanings for correct reference in subsequent nodes
4. **Connect Subsequent Nodes**:
    1. Connect Personnel Retrieval Node output to nodes needing personnel information
    2. Use `nodeName.userData` to reference search results in subsequent nodes

## Important Notes
### Search Efficiency
When organization size is large, note how search condition settings affect efficiency:
- Prefer precise conditions (like employee ID, mobile number) over fuzzy conditions (like name contains)
- Reasonably combine multiple conditions to narrow search scope
- Avoid unnecessary full-scale queries to reduce system load

### Data Permissions
Personnel retrieval is restricted by current Bot account permissions:
- Can only retrieve departments and personnel Bot has permission to access
- Some sensitive information (like mobile numbers) may require specific permissions
- Ensure Bot account has sufficient organizational structure access permissions

### Data Timeliness
Personnel information may change, need to note:
- Search results reflect organizational structure state at current moment
- Need strategies for handling personnel position changes, resignations, etc.
- Recommend adding result verification logic for critical processes

## Common Issues
### Issue 1: What If Search Conditions Set But Not Returning Expected Results?
**Solutions**: Might be condition mismatch or permission issues. Recommend:
- Check if condition values are correct, especially variable references
- Confirm comparison operators used correctly (like "Equals" vs "Contains")
- Try relaxing conditions or using more precise conditions (like employee ID)
- Check if Bot account has permission to access target personnel information

### Issue 2: How to Handle Cases of Same Names?
**Solutions**: Same names are common in large organizations:
- Combine multiple conditions (like name + department) for filtering
- Prioritize using unique identifiers (like employee ID or user ID) for searching
- Add same name judgment logic when processing results (like distinguishing by department)

### Issue 3: Is There a Limit to Search Result Quantity?
**Solutions**: Yes, usually there are return quantity limits:
- Maximum 50 matching records returned by default
- For querying large numbers of users, consider batch processing or optimizing search conditions
- For large-scope scenarios like whole department queries, consider using more professional reporting tools

## Common Paired Nodes
|Node Type|Pairing Reason|
|---|---|
|Message Reply Node|Display retrieved personnel information to users|
|Conditional Branch Node|Decide subsequent process based on whether search results exist|
|Large Model Call Node|Use personnel information to build personalized replies or analysis|
|Create Group Chat Node|Automatically create specific group chats based on search results|
|HTTP Request Node|Send personnel information to external systems for processing| 