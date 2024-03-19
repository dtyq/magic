# 一句话实现复杂任务
## 背景知识
在工作中，我们通常需要通过上级的一句话，去理解上级的意图，并拆解成工作任务，和一步步执行， 本文档展示在麦吉中，如何通过一句话实现复杂任务的处理

## 案例介绍
麦吉项目助理是用于企业管理中， 协助管理者完成项目管理，帮助管理者处理项目跟进琐碎的事，让项目管理者将时间聚焦核心事务。


## 实现方式：
**思考Agent (DeepSeek)**： 输出任务执行计划。

**任务拆分Agent (GPT4o)**： 负责拆分任务步骤。

**任务执行Agent (GPT4o)**： 按照步骤执行任务


## 实现步骤
一、搭建主流程：
1、使用DeepSeek- R1模型用于理解和思考用户意图
2、通过意图节点，判断是走任务拆分还是走任务执行
3、描述需要用到的工具，和工具能力

![主流程](https://cdn.letsmagic.cn/static/img/flow1.png)


二、搭建任务拆分流程，按照推理出的用户意图，拆解步骤和任务
1、创建一个任务拆分流程

![任务拆分流程](https://cdn.letsmagic.cn/static/img/flow2.png)


2、选择GPT4o 作为任务拆分的模型 

![选择模型](https://cdn.letsmagic.cn/static/img/flow3.png)

三、搭建任务执行流程，加载相应的工具
1、创建执行任务的流程

![执行任务流程](https://cdn.letsmagic.cn/static/img/flow4.png)

2、加载所需要执行任务的工具

![加载工具](https://cdn.letsmagic.cn/static/img/flow5.png)

四、观测并验证效果

![验证效果](https://cdn.letsmagic.cn/static/img/flow5.png)