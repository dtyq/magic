# Building an AI Translation Assistant

With the continuous advancement of artificial intelligence technology, large language models have demonstrated excellent performance in translation quality, efficiency, context understanding, and multilingual support. As a result, more and more people are using large models to quickly build their own translation assistants for text translation, improving efficiency and reducing costs.

This tutorial provides detailed guidance on how to quickly build an AI assistant on the Magic platform.

# AI Translation Assistant Introduction
You only need to set the target translation language in the AI assistant settings, and then you can directly provide the text you want to translate to the AI assistant through conversation. The AI assistant will directly return the language translated by the large model, making it efficient and fast.
![Translation Screenshot](https://cdn.letsmagic.cn/static/img/Translation-assistant-1.png)

## 1. Design the Desired Effect
The core functionality of this AI translation application is to meet users' text translation needs. No additional text introduction is needed - users input what they want translated, and the corresponding translated text is returned directly. The translation function can be implemented by creating a workflow that includes a large model node.

Based on the above scenario goals, our designed workflow will include the following nodes:
1. User input node
2. Set AI assistant welcome message
3. Node to receive user input and translate through the large model
4. Node to output translated content

## 2. Create AI Translation Assistant
1. Log in to the [Magic](https://www.letsmagic.cn/login) platform. (If using private deployment, log in to the corresponding private deployment platform)
2. Click on "AI Assistant" in the left menu bar, then click "Create AI Assistant" on the right
3. Upload the assistant image and fill in the assistant's name and a brief description
4. Click "Create" to successfully enter the AI assistant's workflow orchestration interface
![Translation Screenshot](https://cdn.letsmagic.cn/static/img/Translation-assistant-2.png)

## 3. Orchestrate Workflow
### 1. Click to create "Start Node"
![Translation Screenshot](https://cdn.letsmagic.cn/static/img/Translation-assistant-3.png)

### 2. In the "When Adding as Friend" area, click the "small circle" to add a message reply node and add the corresponding welcome message
> Hello <font color="#2045D4">@start node/user nickname</font>,
I am your dedicated English translation assistant. You can directly tell me any text that needs translation, and I will provide you with the most authentic localized translation as soon as possible.

![Translation Screenshot](https://cdn.letsmagic.cn/static/img/Translation-assistant-4.png)

### 3. Add "Large Model Call Node" when receiving new messages
3.1. In the model area, select the supported large model node, keep other parameters unchanged, and also enable visual understanding capability (default selection is GPT-4)
![Translation Screenshot](https://cdn.letsmagic.cn/static/img/Translation-assistant-5.png)

3.2. In the input area, fill in the prompt for the large model in the System input box, and reference the user content from the previous node using @ in the User area
```
#Role
You are a professional English translator who can accurately translate any content input by the user into English without arbitrary expansion.
##Skills
###Skill 1: Translate Text
- When the user provides a piece of text, quickly translate it into English.
- Ensure the accuracy and fluency of the translation. Make the translation as localized as possible.
- Any language is acceptable, whether it's Chinese, Japanese, Malay, Thai, etc., all need to be translated into English based on semantics.
##Limitations:
- Only perform translation work, do not answer questions unrelated to translation.
- Strictly follow the target language required by the user, do not change it without authorization.
```
![Translation Screenshot](https://cdn.letsmagic.cn/static/img/Translation-assistant-6.png)

### 4. Add Message Reply Node
4.1 Select the message type as "Text" and reference the large model's response content using @ in the message content to return to the user
![Translation Screenshot](https://cdn.letsmagic.cn/static/img/Translation-assistant-7.png)

### 5. Publish Assistant
Publishing is divided into "Personal Use" and "Enterprise Internal". The difference is that personal use is only visible and usable by yourself, while publishing to enterprise internal supports more permission management, such as version number recording, setting visibility scope, publishing to third-party platforms, etc. For this release, directly select "Personal Use".
5.1 You can directly converse with the AI assistant to quickly help you translate different languages into English
![Translation Screenshot](https://cdn.letsmagic.cn/static/img/Translation-assistant-8.png)

## 4. Important Notes
### 1. What is a System Prompt?
A system prompt is a set of instructions that guide the model's behavior and functional scope. It can include how to ask questions, how to provide information, how to request specific functions, etc. System prompts are also used to set the boundaries of the conversation, such as informing users which types of questions or requests are not accepted. 