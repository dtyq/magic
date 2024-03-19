# Vector Knowledge Base Matching Node

## What is a Vector Knowledge Base Matching Node?
The Vector Knowledge Base Matching Node is a specialized node in Magic Flow workflows for retrieving and matching vector knowledge base content. It helps you filter out needed vector knowledge bases based on specific conditions, providing foundational support for subsequent operations (such as similarity search, knowledge Q&A, etc.). Simply put, this node is like filtering out appropriate "bookshelves" from your vector knowledge base, so you can later find relevant information on these "bookshelves".

**Image Description:**

The Vector Knowledge Base Matching Node interface mainly consists of two parts - the "Configure Filter Conditions" area at the top for setting vector knowledge base filter conditions, and the "Output" area at the bottom displaying the filtered vector knowledge base list. Filter conditions support various matching methods such as equals, not equals, contains, not contains, etc., by ID or name.
![Start Node](https://cdn.letsmagic.cn/static/img/Vector-knowledge-base-matching.png)

## Why Do We Need a Vector Knowledge Base Matching Node?
**In the process of building intelligent applications, the Vector Knowledge Base Matching Node plays the role of a "knowledge filter", helping you:**
- **Precisely Locate Knowledge Sources**: Filter out knowledge bases meeting specific conditions from multiple vector knowledge bases
- **Improve Retrieval Efficiency**: Narrow down the scope of subsequent vector searches, improving retrieval accuracy and speed
- **Dynamically Select Knowledge Bases**: Dynamically select appropriate knowledge bases based on different scenarios or user needs
- **Multi-condition Combination Filtering**: Support multi-condition combination filtering to achieve complex knowledge base matching logic
- **Provide Data for Downstream Nodes**: Provide filtered knowledge base lists for subsequent vector search nodes

## Application Scenarios
### 1. Multi-domain Intelligent Q&A System
When building a Q&A system covering multiple domains, you can first use the Vector Knowledge Base Matching Node to filter out knowledge bases related to the user's question domain, then perform precise content retrieval to improve answer accuracy.
### 2. Permission-controlled Knowledge Retrieval
Within enterprises, different departments or roles may have access to different knowledge bases. Through the Vector Knowledge Base Matching Node, you can filter out knowledge bases that users have permission to access based on their department or role information, ensuring information security.
### 3. Multi-knowledge Base Collaborative Retrieval
When needing to perform collaborative retrieval across multiple related knowledge bases, you can first use the Vector Knowledge Base Matching Node to filter out these related knowledge bases, then perform unified retrieval across these knowledge bases to obtain more comprehensive information.

## Node Parameter Description
### Basic Parameters
|Parameter Name|Description|Required|Default Value|
|---|---|---|---|
|Search Conditions|Set condition combinations for searching vector knowledge bases|Yes|None|

### Search Condition Details
|Condition Component|Optional Values|Description|
|---|---|---|
|Left Value Type|Knowledge Base ID|Filter by knowledge base unique identifier|
||Knowledge Base Name|Filter by knowledge base name|
|Operator|Equals|Exact match with specified value|
||Not Equals|Exclude results exactly matching specified value|
||Contains|Contains specified string|
||Not Contains|Does not contain specified string|
|Right Value|Custom Input|Input specific filter value, can be ID or name (depending on left value type)|

### Output Content
|Output Field|Description|
|---|---|
|Vector Knowledge Base List (vector_databases)|Filtered vector knowledge base list, containing ID and name of each knowledge base|

## Usage Instructions
### Basic Configuration Steps
1. **Add Search Conditions**:
    1. Click "Add Condition" button to add a filter condition
    2. Select "Knowledge Base ID" or "Knowledge Base Name" from left value type dropdown
    3. Select appropriate operator (equals, not equals, contains, not contains)
    4. Input specific filter value in right value input box
2. **Set Multiple Conditions** (Optional):
    1. If multiple conditions are needed, repeat clicking "Add Condition" button
    2. Choose "AND" or "OR" relationship between multiple conditions
3. **Condition Combination** (Optional):
    1. For complex filter logic, can create condition groups
    2. Click "Add Condition Group" button to create new condition group
    3. Add conditions within condition group and set relationships between conditions
4. **Preview Output**:
    1. After configuration, can preview filtered vector knowledge base list in node's output section

### Advanced Techniques
#### Efficient Search Strategies
1. **Precise Filtering**: When you know the target knowledge base's ID or complete name, use "equals" operator for exact matching
2. **Fuzzy Filtering**: When you only know part of knowledge base name, use "contains" operator for fuzzy matching
3. **Exclusion Strategy**: Use "not equals" or "not contains" operators to exclude unwanted knowledge bases

#### Collaboration with Other Nodes
**Vector Knowledge Base Matching Node usually needs to be used in combination with other nodes:**
1. **Combined with Vector Search Node**:
    1. Use Vector Knowledge Base Matching Node to filter out related knowledge bases
    2. Then use Vector Search Node to perform content similarity retrieval in these knowledge bases
2. **Combined with Conditional Branch Node**:
    1. Determine subsequent process based on whether filter results are empty
    2. Can set backup plan when no matching knowledge bases are found
3. **Combined with Large Model Call Node**:
    1. Pass filtered knowledge base information to large model
    2. Let large model generate answers based on these specific knowledge bases

## Notes
### Permission Restrictions
Node can only filter vector knowledge bases that current user has permission to access:
- Knowledge bases without access permission won't appear in filter results, even if they meet filter conditions
- Ensure workflow creator has read permission for related knowledge bases

### Performance Considerations
When there are many knowledge bases, complex filter conditions may affect execution efficiency:
- Try to use precise filter conditions
- Avoid using too many "contains" or "not contains" operators
- Minimize nesting levels of condition groups as much as possible

### Empty Result Handling
If filter conditions are too strict, may result in no knowledge bases meeting conditions:
- Must handle possible empty result situations in workflow
- Consider using conditional branch node to check if filter results are empty

## Common Issues
### Issue 1: No knowledge bases returned after search, but I'm sure there are knowledge bases meeting conditions, what could be the reason?
**Solution**: Possible reasons include:
- Permission issues: You may not have access permission to these knowledge bases
- Condition setting errors: Check if filter conditions' spelling, case sensitivity, etc. are correct
- Knowledge base status: Target knowledge bases may be disabled or deleted

### Issue 2: How to filter knowledge bases by both ID and name?
**Solution**: You can add multiple filter conditions:
- Add first condition, select "Knowledge Base ID" as left value type, set corresponding operator and right value
- Click "Add Condition" button to add second condition
- Select "Knowledge Base Name" as left value type, set corresponding operator and right value
- Choose "AND" or "OR" relationship between two conditions

### Issue 3: How to use the vector knowledge base list output by node in subsequent nodes?
**Solution**: The output vector knowledge base list can be used in subsequent nodes through variable references:
- In Vector Search Node, can reference `previous_node_output.vector_databases`
- If need to get specific knowledge base's ID, can use `previous_node_output.vector_databases[0].id`
- In Code Execution Node, can access and process this data through JavaScript

## Common Node Combinations
|Node Type|Combination Reason|
|---|---|
|Vector Search Node|Perform content similarity retrieval in filtered knowledge bases|
|Conditional Branch Node|Determine subsequent processing flow based on filter results|
|Large Model Call Node|Use filtered knowledge bases for knowledge-enhanced Q&A|
|Variable Save Node|Save filter results for use by multiple subsequent nodes|
|Code Execution Node|Perform advanced processing or transformation on filter results| 