# Create Group Chat Node
## What is a Create Group Chat Node?
The Create Group Chat Node is a function node in Magic Flow specifically designed for creating multi-person chat groups. Through this node, you can automatically create various types of group chats in your workflow, such as internal work groups, project groups, training groups, etc., and automatically add specified members. It's just like manually creating a group chat in your daily social software, but this process can be done automatically in the workflow.

**Image Description:**

The Create Group Chat Node interface contains configuration items such as group name, group owner, group members, group type, etc., as well as options to add the current user and assistant to the group chat. You can automatically create various types of group chats that meet business needs through simple configuration.
![Create Group Chat Node](https://cdn.letsmagic.cn/static/img/Create-group-chat.png)

## Why do you need a Create Group Chat Node?
In intelligent workflows, automatically creating group chats can solve many practical problems:
1. **Automated Collaboration Process**: Automatically form relevant work groups when new projects start, new customers join, or new tasks are created, ensuring timely and effective information transmission.
2. **Standardized Communication Channels**: Create standardized group chats according to preset templates, ensuring consistency and standardization of internal communication channels in the organization.
3. **Improved Response Speed**: Automatically create group chats and add relevant personnel when specific events are triggered, reducing the time for manual group chat creation and improving work efficiency.
4. **Intelligent Group Member Management**: Automatically add appropriate members according to business rules, avoiding situations where personnel are missed or incorrect personnel are added.

## Application Scenarios
### Scenario One: Automatic Group Creation for New Project Launch
When a new project is established, automatically create a project group, set the project manager as the group owner, add project team members and relevant department heads to the group, and have the project assistant robot send a project launch notification.

### Scenario Two: Customer Service Process
When new customers register or submit specific service requests, automatically create a service group, adding customers, customer service personnel, and relevant experts, so that customer issues can be efficiently resolved in the dedicated group chat.

### Scenario Three: Training Course Organization
The training system can automatically create a training group for each new course, adding instructors, students, and course teaching assistants, with the assistant robot sending course introductions and learning materials.

## Node Parameter Description
### Input Parameters
|Parameter Name|Description|Required|Example Value|
|---|---|---|---|
|Group Name|Set the name of the created group chat|Yes|"Project A Development Team"|
|Group Owner|Set the administrator of the group chat, must specify one user as the group owner|Yes|User variable or direct selection|
|Group Members|List of other members to be added to the group chat|No|User array or direct selection|
|Group Type|Select the group chat type, different types of group chats may have different permission settings|Yes|Internal group, project group, etc.|
|Add Current User to Group Chat|Whether to add the user who triggered the workflow to the group chat|No (Enabled by default)|Check or uncheck|
|Add Current Assistant to Group Chat|Whether to add the AI assistant of the current workflow to the group chat|No (Enabled by default)|Check or uncheck|

### Group Type Description
The Create Group Chat Node supports the following group types:
|Type ID|Type Name|Description|
|---|---|---|
|1|Internal Group|Regular group chat within the organization|
|2|Internal Training Group|Dedicated group chat for internal training|
|3|Internal Meeting Group|Group chat for internal meeting discussions|
|4|Internal Project Group|Group chat for project collaboration|
|5|Internal Work Order Group|Group chat for work order processing|
|6|External Group|Group chat that can include external members|

### Output Results
The Create Group Chat Node does not have standard output parameters; its main function is to execute the action of creating a group chat.

## Usage Instructions
### Basic Configuration Steps
1. **Add Node**: In the workflow editor, select the "Create Group Chat" node from the left node panel and drag it to an appropriate position on the workflow canvas.
2. **Set Group Name**:
    1. Click the "Group Name" input field
    2. Enter a meaningful group chat name, or select a variable containing the group name
3. **Select Group Owner**:
    1. Click the "Group Owner" selection box
    2. Select a user from the user list as the group owner, or use a variable reference
4. **Add Group Members** (optional):
    1. Click the "Group Members" selection box
    2. Select the group members to be added, which can be multiple users or user array variables
5. **Select Group Type**:
    1. Select a group type that suits your needs from the dropdown menu
6. **Set Auto-Add Options**:
    1. Choose whether to automatically add the current user and assistant to the group chat as needed

### Advanced Techniques
1. **Dynamically Set Group Name**:
    1. You can use variable combinations to generate group names, such as: `"Project [project_name] Discussion Group"`
    2. This way, meaningful group names can be automatically generated based on actual business data
2. **Intelligent Group Member Addition**:
    1. Combined with the "Personnel Retrieval" node, relevant personnel can be automatically found and added based on department, position, or tags
    2. For example: `department.tech_department.members` will add all members of the tech department
3. **Conditional Group Chat Creation**:
    1. Paired with the "Condition Branch" node, different types of group chats can be created based on different conditions
    2. For instance, create different types of project groups based on project size
4. **Automatic Operations After Group Chat Creation**:
    1. After creating a group chat, you can use the "Message Reply" node to automatically send a welcome message in the group
    2. You can also use the "Large Model Call" node to generate personalized group announcements

## Precautions
### Group Owner Settings
- The group owner must be a valid user in the system, otherwise the group chat creation will fail
- If using variables to set the group owner, ensure that the variable value is a valid user object containing user ID information
- It is recommended to use the results of the "Personnel Retrieval" node as input for the group owner and group members

### Group Member Limitations
- Adding too many members may affect group chat creation performance, it is recommended to control within a reasonable range
- If some users do not exist or cannot be added, the node will skip these invalid users and will not cause the entire node to fail

### Assistant Opening Remarks
- The assistant opening remarks setting will only take effect when the "Add Current Assistant to Group Chat" option is enabled
- Assistant opening remarks support variable references and can dynamically generate personalized opening remarks based on business context

### Group Chat Creation Conditions
- The group chat creation function is only effective in IM chat environments
- In non-IM environments (such as API calls, timed triggers, etc.), the node will simulate the creation process but will not actually create a group chat

## Frequently Asked Questions
### What to do if group chat creation fails?
**Problem**:
Configured the Create Group Chat node, but it reports an error or fails to create a group chat when executed.

**Solution**:
1. Check if the group owner is a valid user; the group owner must be an existing user in the system
2. Confirm that the group name is not empty and is in the correct format
3. Verify that the selected group type is valid
4. Check if the execution environment supports creating group chats (needs to be in an IM environment)

### How to get the ID of the created group chat?

**Problem**:
After creating a group chat, how to reference this group chat in subsequent nodes?

**Solution**:
The Create Group Chat node outputs a result containing the group ID, which can be obtained in subsequent nodes through variable references:
- Use `previous_node.result.group_id` to get the group chat ID
- Use `previous_node.result.name` to get the group chat name

### Why can't some users be added to the group chat?

**Problem**:
Multiple group members were configured, but some members were not successfully added to the group chat.

**Solution**:
1. Confirm that these users exist in the system and their status is normal
2. Check if permission issues prevent adding certain users
3. Verify that the user data format is correct and must contain user ID information

## Common Node Combinations
|**Node Type**|**Combination Reason**|
|---|---|
|Personnel Retrieval Node|Retrieve users that meet conditions and create group chats with these users as members|
|Condition Branch Node|Create different types of group chats or group chats with different member compositions based on different conditions|
|Large Model Call Node|Use the large model to generate personalized group names or opening remarks| 