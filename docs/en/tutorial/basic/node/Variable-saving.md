# Variable Saving Node

## What is a Variable Saving Node?
The Variable Saving Node is a basic data processing node in Magic Flow, used to create, set, or update variables within workflows. This node helps you store temporary data in the process for use by subsequent nodes, enabling data transfer and sharing between different nodes.

**Image Description:**

The Variable Saving Node interface consists of a variable basic information setting area on the left and a variable value configuration area on the right. Here you can set the variable name, display name, select variable type, and assign specific values to variables.
![Variable Saving Node](https://cdn.letsmagic.cn/static/img/Variable-saving.png)

## Why Do We Need a Variable Saving Node?
When building workflows, we often need to temporarily store some data, such as user input, calculation results, or intermediate states, for use at different stages of the workflow. The Variable Saving Node is designed to meet this need. It can:
- Create new variables or update values of existing variables
- Support multiple data types to meet different storage needs
- Provide data support for other nodes in the workflow
- Enable data transfer and sharing within workflows

## Application Scenarios
### Scenario 1: Storing User Input
When you need to record information provided by users in conversations (such as name, age, preferences, etc.), you can use the Variable Saving Node to save this information for use in subsequent nodes.
### Scenario 2: Saving Intermediate Calculation Results
In complex workflows, you may need to perform multi-step data processing. The Variable Saving Node can help you store calculation results from each step, avoiding redundant calculations.
### Scenario 3: Dynamic Control of Workflow Direction
You can use the Variable Saving Node to store flags or status values, then use these variable values in conditional branch nodes to determine the workflow execution path.

## Node Parameter Description
The Variable Saving Node's parameters are mainly divided into two parts: variable basic information and variable value settings.

### Variable Basic Information
|Parameter Name|Description|Required|Example Value|
|---|---|---|---|
|Variable Name|Unique identifier for the variable, can only contain letters, numbers, and underscores, used to reference the variable in code or other nodes|Yes|user_name|
|Display Name|Human-readable name for the variable, making it easier to identify the variable's purpose in the workflow|No|User Name|
|Variable Type|Data type of the variable, determining what kind of data the variable can store|Yes|String|
|Variable Value|Value to set for the variable, can be a fixed value or obtained from other node outputs|Yes|Fixed Value|

### Variable Type Options
**The Variable Saving Node supports the following common variable types:**
1. **String** - Used for storing text content
2. **Number** - Used for storing integers or decimals
3. **Boolean** - Used for storing yes/no, true/false binary values
4. **Array** - Used for storing collections of multiple values
5. **Object** - Used for storing complex data structures with multiple key-value pairs

### Variable Value Settings
**The way to set variable values differs based on the selected variable type:**
- **String**: Can directly input text or reference other variables
- **Number**: Input numeric values or mathematical expressions
- **Boolean**: Choose "true" or "false"
- **Array**: Add multiple elements, each element can be of different types
- **Object**: Add multiple key-value pairs, specifying key names and values for each property

## Usage Instructions
### Basic Configuration Steps
1. **Add Node**: In the workflow editor, find the "Variable Saving" node from the left node panel and drag it to an appropriate position in the workflow canvas.
2. **Set Variable Name**: In the right property panel, assign a meaningful name to the variable, recommended to use lowercase letters with underscores, such as `user_age`.
3. **Add Display Name** (Optional): Enter a Chinese name that's easy to understand, such as "User Age".
4. **Select Variable Type**: Choose the appropriate variable type based on the data type you need to store.
5. **Set Variable Value**:
    1. For **Fixed Values**: Directly input the specific value in the input box
    2. For **Referencing Other Variables**: Click the "curly braces" icon and select the variable to reference from the popup list
    3. For **Complex Types** (like arrays or objects): Click the "Add Parameter" button to add elements or properties
6. **Connect Nodes**: Connect the Variable Saving Node with other nodes in the workflow using connection lines to ensure proper workflow execution.

### Advanced Usage Techniques
#### Technique 1: Referencing Other Variables
Variable values can not only be fixed but can also reference other defined variables. By using the `{{variable_name}}` syntax in the value input box, you can dynamically obtain values from other variables.
#### Technique 2: Using Expressions
For numeric type variables, you can use simple mathematical expressions as variable values, such as `{{num1}} + {{num2}} * 2`.
#### Technique 3: Conditional Assignment
Combined with code execution nodes, you can implement assigning different values to variables based on conditions.

## Notes
### Variable Naming Conventions
- Variable names can only contain letters, numbers, and underscores
- Variable names cannot start with numbers
- Variable names are case-sensitive
- Avoid using system reserved keywords as variable names

### Variable Value Update Mechanism
- If a variable with the same name already exists in the workflow, the Variable Saving Node will overwrite the existing value
- If the referenced variable doesn't exist, it may cause workflow execution errors
- When updating complex type variables (like arrays or objects), it completely replaces the existing value rather than partially updating

### Scope Limitations
- Variable scope is limited to the current workflow, sub-processes need to access parent process variables through parameter passing
- Variables are cleared after workflow execution ends, if persistence is needed, use data storage nodes

## Common Issues
### Issue 1: Why can't I use the variable I set in other nodes?
**Solution**: There could be several reasons:
- Variable name input error or case mismatch
- Variable Saving Node wasn't executed (e.g., located in a conditional branch and condition wasn't met)
- Variable reference syntax is incorrect, correct reference method uses double curly braces: `{{variable_name}}`

### Issue 2: How to store complex JSON data in Variable Saving Node?
**Solution**:
Choose "Object" type, then build the JSON structure by adding multiple key-value pairs. For nested structures, you can select "Object" type again in sub-properties. Alternatively, use code execution nodes to process complex JSON, then assign the result to a variable.

### Issue 3: What to do if variable type is selected incorrectly?
**Solution**:
You can adjust the variable type at any time, but this will reset the variable value settings. It's recommended to carefully consider the variable's purpose and possible values before selecting the appropriate type.

## Common Node Combinations
|**Node Type**|**Combination Reason**|
|---|---|
|Conditional Branch Node|Store variables for judgment conditions, used to control workflow execution path|
|Code Execution Node|Store results of code calculations|
|HTTP Request Node|Interact with internal and external systems through APIs|
|Large Model Call Node|Store content generated by large models| 