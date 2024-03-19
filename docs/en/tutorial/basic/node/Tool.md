# Tool Node

## What is a Tool Node?
The Tool Node is a powerful node in Magic Flow that allows you to call and use various preset tools within workflows. Like a multi-functional Swiss Army knife, the Tool Node helps you execute specific tasks such as data processing, information queries, or automated operations. You can use these tools in two ways: through natural language descriptions (large model calls) or direct parameter settings (parameter calls), meeting different scenario requirements.

**Image Description:**

The Tool Node interface mainly consists of a call mode selection area and a parameter configuration area. At the top, you can choose between "Large Model Call" or "Parameter Call" modes, while below is the system's custom input parameter configuration area, supporting the addition of multiple parameters and their expressions.
![Tool Node](https://cdn.letsmagic.cn/static/img/Tool.png)

## Why Do We Need a Tool Node?
When building intelligent workflows, you often need to execute standardized tasks or call specific functions. The Tool Node exists to solve this problem:
1. **Function Extension**: Expands Magic Flow's capabilities, enabling workflows to perform more specialized tasks
2. **Standardized Operations**: Provides a unified interface for calling various tools, simplifying workflow design
3. **Flexible Calls**: Supports multiple calling methods, making it easy to use even without technical background
4. **Process Automation**: Converts manual operations into automated processes, improving efficiency and consistency

## Application Scenarios
The Tool Node is suitable for various scenarios, including but not limited to:
1. **Information Queries**: Calling search tools to obtain real-time information or professional knowledge
2. **Data Processing**: Using data transformation tools to process and format workflow data
3. **Automated Operations**: Triggering automated tasks such as sending notifications or creating schedules
4. **Intelligent Assistant Enhancement**: Adding practical tool capabilities to chatbots, such as weather queries or text translation

## Node Parameter Description
### Input Description
The Tool Node's input parameters are mainly divided into two categories: call mode settings and tool parameter configuration.
|Parameter Name|Description|Required|Default Value|
|---|---|---|---|
|Call Mode|Select tool calling method, including [Large Model Call] and [Parameter Call]|Yes|Large Model Call|
|Select Tool|Choose the tool name to use|Yes|None|
|Model|When using [Large Model Call], select the model to use|Yes|GPT-4o|
|Prompt|Use prompts to guide the large model, ensuring accurate usage, supports using variables with @|No|None|

### Output Description
After Tool Node execution, it outputs the following:
|Output Name|Description|Example|
|---|---|---|
|Output Text|Result text from tool execution|"Current Beijing weather: Sunny, 25°C"|
|Execution Status|Tool execution status, success or failure|"success"|
|Error Message|If execution fails, contains error details|"API call timeout"|

## Usage Instructions
### Basic Configuration Steps
1. **Add Tool Node**
    1. Drag "Tool" node from node panel to workflow canvas
    2. Connect node with other nodes in workflow
2. **Select Call Mode**
    1. Choose "Large Model Call" or "Parameter Call" in node configuration panel
    2. Large Model Call: Suitable for using tools through natural language descriptions
    3. Parameter Call: Suitable for using tools through direct parameter configuration
3. **Configure Parameters**
    1. Click "Add" button to add parameters required by tool
    2. Fill in parameter name, set whether required
    3. Select appropriate expression type (such as text, number, etc.)
    4. Fill in parameter value or expression
4. **Set Nested Parameters (if needed)**
    1. For complex tools, click "+" button next to parameter to add sub-parameters
    2. Configure sub-parameters in same way
5. **Configure Output**
    1. Select output format in "Output" section (default is text)
    2. Enable or disable certain output items as needed

### Advanced Techniques
1. **Using Variable References**
    1. Check "Use @flow variables" option to use @ symbol to reference workflow variables in parameter values
    2. Example: Enter "@user_question" in parameter value to use "user_question" variable value from workflow
2. **Dynamic Parameter Calculation**
    1. Can use simple calculation formulas in expressions
    2. Example: "{{count + 1}}" will automatically calculate result of count variable value plus 1
3. **Using Tool Results in Conditional Judgments**
    1. Tool Node output can be used as input for conditional branch nodes
    2. Can choose different process branches based on tool execution results

## Notes
### Parameter Configuration Notes
1. **Parameter Naming Conventions**
    1. Parameter names should be concise and clear, reflecting parameter purpose
    2. Avoid spaces and special characters, recommend using English letters, numbers, and underscores
2. **Required Parameter Handling**
    1. All parameters marked as "required" must have valid values configured
    2. If required parameters have no values, tool cannot execute normally
3. **Parameter Value Format**
    1. Ensure parameter values conform to tool's required format
    2. Special type data like dates and numbers need to be provided in specified format

### Performance and Limitations
1. **Execution Timeout**
    1. Tool calls have default timeout limit (usually 30 seconds)
    2. Long-running tools may fail due to timeout
2. **Call Frequency**
    1. Some tools may have call frequency limits
    2. Avoid frequently calling same tool in short time period

## Common Issues
### Issue 1: What to do when Tool Node execution fails?
**Solution**: When Tool Node execution fails, you can troubleshoot through following steps:
1. Check if all required parameters are correctly configured
2. View error message to understand specific failure reason
3. Confirm parameter format is correct, especially for special formats like dates and JSON
4. Check if network connection is normal (for tools requiring network access)
5. If using variable references, confirm variable exists and has value

### Issue 2: How to choose between Large Model Call and Parameter Call?
**Solution**: Suggestions for choosing call mode:
- **Large Model Call**: Suitable for scenarios requiring natural language understanding, such as when you want to use tools through descriptive language, or when tool input parameters are complex
- **Parameter Call**: Suitable for scenarios with clear, fixed parameters, can obtain more stable, predictable results, suitable for process-oriented, standardized tasks

## Common Node Combinations
|**Node Type**|**Combination Reason**|
|---|---|
|Large Model Call Node|Tool Node can serve as extension capability for large models, handling professional tasks|
|Conditional Branch Node|Determine subsequent process direction based on tool execution results|
|Message Reply Node|Display tool execution results as reply content to users|
|Variable Save Node|Save tool execution results for use by subsequent nodes| 