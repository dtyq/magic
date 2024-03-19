<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\LLM;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Connector\Component\ComponentFactory;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class LLMCallNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::LLMCall, json_decode(<<<'JSON'
{
    "model": {
        "id": "component-66c6f20f1cc8b",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "input",
                    "value": "gpt-4o-global",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "system_prompt": {
        "id": "component-66470a8b547b2",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "input",
                    "value": "# 角色\r\n你是一位极其专业且富有责任心的访客系统录入员，秉持严谨缜密的态度开展访客系统的重要信息记录工作。\r\n\r\n## 技能\r\n### 技能 1: 精准的信息录入\r\n1. 当有访客进行登记时，全面细致地询问并精确记录访客姓名、联系方式、来访时间等关键信息，同时确保来访时间为未来时间，且联系方式正常，如 110 这类报警电话不可用。\r\n2. 保证录入信息百分之百准确无误且完整无缺。\r\n\r\n### 技能 2: 细致的信息核验\r\n1. 录入完成后，仔细检查已录入的信息，决不容许出现任何错误或遗漏。若发现有误，当即更正。若有遗漏，请引导用户填写。\r\n2. 确认访客姓名、联系方式、来访时间用户都已经完整填写，按照能直接进行 json_decode 的 json 格式输出数据，如 {\"name\":\"小李\",\"phone\":\"13800138000\",\"time\":\"20240517 15:30\"}，不允许有其他字符。针对非标准格式的来访时间，进行格式统一转换。\r\n\r\n### 技能 3: 热忱的帮助供给\r\n1. 倘若访客对登记流程存在疑问，务必耐心解答。\r\n2. 给予访客必要的引导和协助。\r\n\r\n## 限制\r\n- 专注处理与访客系统有关的信息，不涉及其他事项。\r\n- 严格遵循信息的保密性与安全性原则。\r\n- 平等公正地对待每一位访客，持续提供高品质服务。\r\n\r\n总结：访客系统录入员需专业、严谨、细致、热情，精准录入核验信息，提供优质服务。^^以上内容援引自访客系统相关规定。",
                    "name": "",
                    "args": null
                }
            ],
            "const_value": null
        }
    },
    "messages": {
        "id": "component-66dad9f890c80",
        "version": "1",
        "type": "form",
        "structure": {
            "type": "array",
            "key": "root",
            "sort": 0,
            "title": "历史消息",
            "description": "",
            "required": null,
            "value": null,
            "items": {
                "type": "object",
                "key": "messages",
                "sort": 0,
                "title": "历史消息",
                "description": "",
                "required": [
                    "role",
                    "content"
                ],
                "value": null,
                "items": null,
                "properties": {
                    "role": {
                        "type": "string",
                        "key": "role",
                        "sort": 0,
                        "title": "角色",
                        "description": "",
                        "required": null,
                        "value": null,
                        "items": null,
                        "properties": null
                    },
                    "content": {
                        "type": "string",
                        "key": "content",
                        "sort": 1,
                        "title": "内容",
                        "description": "",
                        "required": null,
                        "value": null,
                        "items": null,
                        "properties": null
                    }
                }
            },
            "properties": null
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
                    "value": "9527.content",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "model_config": {
        "temperature": 0.5
    }
}
JSON, true));

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-662617c744ed6",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "required": [
            "text"
        ],
        "value": null,
        "items": null,
        "properties": {
            "text": {
                "type": "string",
                "key": "text",
                "sort": 0,
                "title": "文本",
                "description": "",
                "required": null,
                "value": null,
                "items": null,
                "properties": null
            }
        }
    }
}
JSON, true)));
        $node->setOutput($output);
        $node->validate();

        // 这里是为了单测
        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {
            $result = [
                'text' => 'response',
            ];

            $vertexResult->setResult($result);
        });

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'content' => '你好，你是谁',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertIsString($vertexResult->getResult()['text']);
    }
}
