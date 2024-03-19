# Basic Introduction
[Tools] and [Sub-processes] are essentially the same in nature, but differ in usage and scenarios.

[Sub-processes]: Generally used to break down the main process, allowing a part of the main process's functional modules to be abstracted into an independent tool capability, thus avoiding an overly large process body and further improving maintenance efficiency.

[Tools]: Tools are generally used to be called by large models, but they can also exist in the form of tool nodes.

**There are several concepts about "tools" that need to be understood**

**System custom parameters**: When a tool exists in the form of a tool node, it defines the custom input parameters of the tool node.

**Large model parameters**: When called by a large model, it defines the input parameters for the large model call.

**Output**: The data returned after the tool is called.

## I. Design the Effect You Want to Achieve
The SRM system is widely used in actual business processes. Users need to frequently search the SRM knowledge base for problem-solving but don't want to set up multiple AI assistants. They hope to support knowledge Q&A for multiple systems on a single AI assistant. Therefore, we need to abstract the user's ability to search the SRM knowledge base into an independent tool for the large model to call.

Based on the above scenario objectives, our designed workflow will include the following parts:

1. Create a knowledge assistant toolkit

2. Add the **srm_knowledge_search** tool under the corresponding knowledge toolkit

3. Configure the corresponding tool on the [Large Model Node] of the corresponding AI assistant

## II. Create a Knowledge Assistant Toolkit
1. Log in to the [Magic](https://www.letsmagic.cn/login) platform. (If it's a private deployment, log in to the corresponding private login platform)
2. Click [AI Assistant] in the left menu bar, and click [Create Toolkit] on the right
3. Upload the toolkit image, and fill in the assistant's name and a simple description
4. Click [Knowledge Assistant Toolkit], and click [Add Tool] on the right
5. Enter [srm_knowledge_search], and add the corresponding description, such as: "Search SRM knowledge base content"

![Tool Screenshot](https://cdn.letsmagic.cn/static/img/tool-1.png)
![Tool Screenshot](https://cdn.letsmagic.cn/static/img/tool-2.png)

## III. Orchestrate Workflow
### 1. Click to Create [Start Node]
1.1 Click [Add Parameter]

1.2 Enter the corresponding large model parameter input content as shown in the figure below

![Tool Screenshot](https://cdn.letsmagic.cn/static/img/tool-3.png)

### 2. Connect and Create [Vector Search Node]
2.1 Select knowledge base: Fixed value, select supply chain knowledge base

2.2 Search keywords: Reference the start node question through @

2.3 Metadata matching: Set the corresponding parameter value

(Parameter name: **knowledge_base_id**, Parameter value: **Fixed value, 716406779765358592**)

![Tool Screenshot](https://cdn.letsmagic.cn/static/img/tool-4.png)

### 3. Connect and Create [Large Model Node]
3.1 In the model area, select a supported large model node, keep other parameters unchanged, and also enable visual understanding capability (here, GPT-4o is selected by default)

![Tool Screenshot](https://cdn.letsmagic.cn/static/img/tool-5.png)

3.2 In the input area, fill in the prompt for the large model in the System input box, and in the User area, reference the **start node question** and **vector search node fragment list** through @

3.3 Enable automatic memory loading

#Role
Data Processing Expert
#Task
Select several highly relevant fragments from the given question, then organize the most appropriate answer.
#Goal
The answer should be based on the selected highly relevant fragments, appropriately expanded on this basis, conforming to the logic of question Q, with smooth and fluent grammar.
#Requirements
1. Based on the given question Q, select the most relevant fragments from the fragment option list;
2. Must ensure that the selected fragments are related to the question. If you think none of the fragments are related to the question and no relevant information can be found, then answer "No content retrieved";
3. The answer should not be rigid, and can be appropriately polished to make it more fluent, but the main idea of the original answer must not be changed;
4. If all fragments have relatively low relevance and no relevant information can be found, then it is considered that no answer exists, and output "No content retrieved";
5. Your answer should not omit images in the fragments, and should display and render images in your answer content;

#Return Format
Return only the answer; return in beautiful markdown format.
#Process
You need to strictly follow the following process to think and execute each step:
1. Receive a question (Q);
2. Select several highly relevant fragments from the fragment list; based on the highly relevant fragments selected in the second step, organize an answer according to question Q, and return it;
3. The answer can be slightly polished to make the grammar fluent;

![Tool Screenshot](https://cdn.letsmagic.cn/static/img/tool-6.png)

### 4. Connect and Create [End Node]
4.1 Add the corresponding end parameter value (Parameter name: **response**, Parameter value: **Fixed value, and reference the large model text string through @**)
      
![Tool Screenshot](https://cdn.letsmagic.cn/static/img/tool-7.png)

### 5. Tool Publication
5.1 Click publish, fill in the corresponding version name and version description

![Tool Screenshot](https://cdn.letsmagic.cn/static/img/tool-8.png)

### 6. AI Knowledge Assistant Reference

6.1 Select the AI assistant that needs to support SRM Q&A, click [Add Tool] in the large model node

6.2 Select [Knowledge Assistant Toolkit], add [srm_knowledge_search] tool, or quickly search through the search bar

![Tool Screenshot](https://cdn.letsmagic.cn/static/img/tool-9.png)
![Tool Screenshot](https://cdn.letsmagic.cn/static/img/tool-10.png)

---
After completing the above configuration, the corresponding AI assistant will be able to support querying the content of the SRM knowledge base. 