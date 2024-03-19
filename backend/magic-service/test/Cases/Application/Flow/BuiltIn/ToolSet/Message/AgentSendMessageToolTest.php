<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\BuiltIn\ToolSet\AtomicNode\Tools;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class AgentSendMessageToolTest extends ExecuteManagerBaseTest
{
    public function testAgentSendMessageToUserTool()
    {
        $node = Node::generateTemplate(NodeType::LLM, json_decode(<<<'JSON'
{
    "model": "gpt-4o-global",
    "system_prompt": {
        "id": "component-66470a8b547b2",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.system_prompt",
                    "name": "",
                    "args": null
                }
            ],
            "const_value": null
        }
    },
    "user_prompt": {
        "id": "component-66470a8b548c4",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.user_prompt",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "model_config": {
        "auto_memory": true,
        "temperature": 0.5,
        "max_record": 10
    },
    "option_tools": [
        {
            "tool_id": "message_agent_send_message_to_user",
            "tool_set_id": "message",
            "async": false,
            "custom_system_input": null
        }
    ]
}
JSON, true));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $node->setOutput($output);

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        // $executionData->setTopicId('750436587206451201');
        // $executionData->setConversationId('728277721403252736');
        // $executionData->setAgentId('725682656757252096');
        $currentDateTime = date('Y-m-d H:i:s');
        $executionData->saveNodeContext('9527', [
            'system_prompt' => <<<MARKDOWN
# 角色
你是一个可以发送消息的助手


## 流程
1、调用 `agent_send_message_to_user` 工具发送消息
2、当前时间是:{$currentDateTime}
-receiver_user_ids是：usi_3715ce50bc02d7e72ba7891649b7f1da

# 上下文


用户的昵称是：当前用户的昵称


MARKDOWN,

            // 'user_prompt' => '帮我创建一个定时任务，任务名称：提醒我做饭，从明天开始，每天早上9点执行，显示一条提醒我做饭的消息',
            'user_prompt' => '帮我发送一条消息,内容是：你今天真好看',
        ]);

        $runner->execute($vertexResult, $executionData);
        // 打印vertexResult
        // var_dump($vertexResult);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testAgentSendMessageToGroupTool()
    {
        $node = Node::generateTemplate(NodeType::LLM, json_decode(<<<'JSON'
{
    "model": "gpt-4o-global",
    "system_prompt": {
        "id": "component-66470a8b547b2",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.system_prompt",
                    "name": "",
                    "args": null
                }
            ],
            "const_value": null
        }
    },
    "user_prompt": {
        "id": "component-66470a8b548c4",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.user_prompt",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "model_config": {
        "auto_memory": true,
        "temperature": 0.5,
        "max_record": 10
    },
    "option_tools": [
        {
            "tool_id": "message_agent_send_message_to_group",
            "tool_set_id": "message",
            "async": false,
            "custom_system_input": null
        }
    ]
}
JSON, true));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $node->setOutput($output);

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        // $executionData->setTopicId('750436587206451201');
        // $executionData->setConversationId('728277721403252736');
        // $executionData->setAgentId('725682656757252096');
        $currentDateTime = date('Y-m-d H:i:s');
        $executionData->saveNodeContext('9527', [
            'system_prompt' => <<<MARKDOWN
# 角色
你是一个可以发送消息的助手


## 流程
1、调用 `agent_send_message` 工具发送消息
2、当前时间是:{$currentDateTime}
-agent_id是：737330322528899073
-group_id是：748917386027667456

# 上下文


用户的昵称是：当前用户的昵称


MARKDOWN,

            // 'user_prompt' => '帮我创建一个定时任务，任务名称：提醒我做饭，从明天开始，每天早上9点执行，显示一条提醒我做饭的消息',
            'user_prompt' => '帮我发送一条消息,内容是：你今天真好看',
        ]);

        $runner->execute($vertexResult, $executionData);
        // 打印vertexResult
        // var_dump($vertexResult);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }
}
