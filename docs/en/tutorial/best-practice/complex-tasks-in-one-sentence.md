# Executing Complex Tasks with One Sentence

## Background
In a work environment, we often need to understand our supervisor's intentions from a single sentence, break it down into work tasks, and execute them step by step. This document demonstrates how to process complex tasks with a single sentence in Magic.

## Case Introduction
The Magic Project Assistant is designed for enterprise management, helping managers complete project management tasks. It handles tedious project follow-up tasks, allowing project managers to focus on core business matters.

## Implementation Method:
**Thinking Agent (DeepSeek)**: Outputs task execution plans.

**Task Breakdown Agent (GPT4o)**: Responsible for breaking down task steps.

**Task Execution Agent (GPT4o)**: Executes tasks according to the steps.

## Implementation Steps
1. Building the main process:
   1. Use DeepSeek-R1 model to understand and think about user intentions
   2. Use the intent node to determine whether to follow task breakdown or task execution
   3. Describe the tools needed and their capabilities

![Main Process](https://cdn.letsmagic.cn/static/img/flow1.png)

2. Build a task breakdown process to break down steps and tasks according to the inferred user intentions
   1. Create a task breakdown flow

![Task Breakdown Flow](https://cdn.letsmagic.cn/static/img/flow2.png)

   2. Choose GPT4o as the model for task breakdown

![Choose Model](https://cdn.letsmagic.cn/static/img/flow3.png)

3. Build a task execution process and load the appropriate tools
   1. Create a task execution flow

![Task Execution Flow](https://cdn.letsmagic.cn/static/img/flow4.png)

   2. Load the tools needed for task execution

![Load Tools](https://cdn.letsmagic.cn/static/img/flow5.png)

4. Observe and verify the results

![Verify Results](https://cdn.letsmagic.cn/static/img/flow5.png) 