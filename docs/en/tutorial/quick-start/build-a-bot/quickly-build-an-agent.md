# Building Your First AI Assistant

Whether you have programming experience or not, you can quickly build an AI assistant on the Magic platform. This article uses a "Smart Nutritionist" assistant as an example to demonstrate how to build a simple AI assistant from scratch.

## AI Assistant Demo

![demo](https://cdn.letsmagic.cn/static/img/20250512165243.jpg)

## Building Steps
Follow these steps to quickly build an AI assistant.

### Create AI Assistant
1. Log in to [Magic](https://www.letsmagic.cn/) and click on "AI Assistant" in the left menu
2. Click "Create AI Assistant" in the top right corner of the page
![create-assistant](https://cdn.letsmagic.cn/static/img/20250512164212.jpg)

3. Enter the AI assistant information and click create
- Avatar Upload: Select an appropriate image as the assistant's avatar (recommended size: 1024 × 1024 pixels). If not uploaded, the default avatar will be used.
- Name: Magic Nutrition Assistant
- Introduction: A personal dietary consultant that can scientifically plan each meal based on users' eating habits and needs, precisely manage every nutrient intake, and help users build a healthy lifestyle.

![assistant-info](https://cdn.letsmagic.cn/static/img/assistant-info.png)

The AI assistant has been created successfully, but it doesn't have any capabilities yet. Let's start giving it abilities.

### Configure Welcome Message
We want users to receive a "welcome message" when they add the "Magic Nutrition Assistant" and be guided on how to use it.
Here's how:
1. Drag out a "Start Node" from the toolbar or click the ➕ button
![start-node](https://cdn.letsmagic.cn/static/img/start-node.png)
2. Click the small circle for "When adding a friend" and select the message reply node
![welcome-message](https://cdn.letsmagic.cn/static/img/welcome-message.png)
3. Write the greeting message in the message reply node
Greeting: I am your personal dietary consultant, scientifically planning each meal, precisely managing every nutrient intake, working together to build a healthy lifestyle, making diet an art that nourishes life. You can say to me, "I weigh 60kg, am 160cm tall, and want to lose 10kg. Please help me plan three balanced meals a day."
![welcome-content](https://cdn.letsmagic.cn/static/img/welcome-content.png)

### Create LLM Node and Write Prompt
1. Add a large model call node for "When receiving a message"
![llm-node](https://cdn.letsmagic.cn/static/img/llm-node.png)
2. Write the prompt to set the role and skills for the large model
![prompt-edit](https://cdn.letsmagic.cn/static/img/prompt-edit.png)

Leave other settings unchanged for now. The prompt is as follows:
```
You are a personal dietary consultant who can scientifically plan each meal based on users' eating habits and needs, precisely manage every nutrient intake, and help users build a healthy lifestyle.
Your responsibilities include:
Providing scientific and reasonable dietary advice and nutrition plans based on users' physical condition, health goals (such as weight loss, muscle gain, health maintenance), lifestyle habits, taste preferences, and other factors, achieving personalized nutrition program customization. Conducting precise nutritional analysis of various ingredients and dishes, helping users understand the energy value and trace element content of the food they consume, performing food nutrition analysis. Assisting users in recording daily meals and providing real-time evaluation and feedback on their dietary structure and nutrient intake, ensuring it meets personal health needs, conducting dietary recording and assessment. Providing professional consultation services for users' nutrition questions and special dietary needs (such as diabetic diet, pregnancy diet, vegetarian nutrition supplementation), answering health consultations. Regularly pushing diverse healthy recipes and providing detailed cooking methods and step-by-step guidance, conducting recipe recommendations and preparation guidance. Long-term tracking of users' health data changes, regularly generating reports to help users understand their nutrition status improvement and adjust dietary strategies, conducting health trend tracking. Spreading nutrition knowledge through interactive methods, improving users' health literacy, and cultivating good eating habits, conducting interactive learning and education.
During the creation process, you must strictly comply with copyright laws and ethical guidelines. You should ensure that all works are original and do not infringe on anyone's intellectual property or privacy rights. Avoid using or imitating any known artist's style or work, ensure your creation is independent, and avoid involving any potentially controversial content.
```
1. Create a reply node for the large model
![llm-reply](https://cdn.letsmagic.cn/static/img/llm-reply.png)
2. Reference the large model's response in the message content editor
- Type the "@" symbol, and after the options appear, scroll to the bottom and select the large model reply node
![model-reference](https://cdn.letsmagic.cn/static/img/model-reference.png)

The final result looks like this:
![final-flow](https://cdn.letsmagic.cn/static/img/final-flow.png)

### Debug the Assistant
1. Click "Test Run" in the top right corner
![debug-run](https://cdn.letsmagic.cn/static/img/debug-run.png)
2. Enter debug parameters: "I have insufficient vitamin C intake, please recommend a healthy recipe" and click confirm
![debug-params](https://cdn.letsmagic.cn/static/img/debug-params.png)
3. Observe the effect - you can see the output node displaying the recipe suggestions provided by the large model

![debug-output](https://cdn.letsmagic.cn/static/img/debug-output.png)

> If not satisfied, you can repeatedly modify the prompt and test run for debugging.

### Publish
1. Click the publish button in the top right corner
![debug-run](https://cdn.letsmagic.cn/static/img/debug-run.png)
2. Select "Personal Use"
![publish-button](https://cdn.letsmagic.cn/static/img/publish-button.png)
3. Click "Chat with AI Assistant"
![chat-with-ai](https://cdn.letsmagic.cn/static/img/chat-with-ai.png)
4. Open a new chat window, and you can start a conversation with the model in the input box
![chat-window](https://cdn.letsmagic.cn/static/img/chat-window.png)
> If you want to edit the AI assistant again, you can do so on the page: click "AI Assistant" -> "Manage AI Assistant" in the top right corner -> find the robot you just created

Congratulations! You have now completed creating your first AI assistant. 