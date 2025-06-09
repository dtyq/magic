<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM;

use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\ModelConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\OptionTool;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\AgentPluginCollector;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;

class LLMChatNodeParamsConfig extends AbstractLLMNodeParamsConfig
{
    protected bool $isLoadAgentPlugin = true;

    public function validate(): array
    {
        $params = $this->node->getParams();

        $this->model = $this->formatModel($params['model'] ?? null);

        $systemPrompt = ComponentFactory::fastCreate($params['system_prompt'] ?? null);
        if (! $systemPrompt?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'system_prompt']);
        }
        $this->systemPrompt = $systemPrompt;

        $userPrompt = ComponentFactory::fastCreate($params['user_prompt'] ?? null);
        if (! $userPrompt?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'user_prompt']);
        }
        $this->userPrompt = $userPrompt;

        $this->modelConfig = new ModelConfig(
            autoMemory: (bool) ($params['model_config']['auto_memory'] ?? true),
            maxRecord: (int) ($params['model_config']['max_record'] ?? ($params['max_record'] ?? 50)),
            temperature: (float) ($params['model_config']['temperature'] ?? 0.5)
        );

        // messages 非必填
        $messages = ComponentFactory::fastCreate($params['messages'] ?? null);
        if ($messages && ! $messages->isForm()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'messages']);
        }
        $this->messages = $messages;

        $this->tools = $params['tools'] ?? [];
        $this->createOptionsToolsByParams($params['option_tools'] ?? []);

        $paramsConfig = [
            // 这里得转换成字符串给前端
            'model' => $this->model->getValue()->getResult(),
            'system_prompt' => $this->systemPrompt->toArray(),
            'user_prompt' => $this->userPrompt->toArray(),
            'model_config' => $this->modelConfig->getLLMChatConfig(),
            'tools' => $this->tools,
            'option_tools' => array_values(array_map(fn (OptionTool $tool) => $tool->toArray(), $this->optionTools)),
            'messages' => $this->messages?->toArray(),
        ];
        return array_merge($this->loadAgentPlugin($params), $paramsConfig);
    }

    public function generateTemplate(): void
    {
        $params = [
            'model' => 'gpt-4o-global',
            'system_prompt' => ComponentFactory::generateTemplate(StructureType::Value)?->jsonSerialize(),
            'user_prompt' => ComponentFactory::generateTemplate(StructureType::Value)?->jsonSerialize(),
            'model_config' => (new ModelConfig())->getLLMChatConfig(),
            'tools' => [],
            'option_tools' => [],
            'messages' => ComponentFactory::generateTemplate(StructureType::Form, Json::decode(
                <<<'JSON'
{
    "type": "array",
    "key": "messages",
    "sort": 0,
    "title": "历史消息",
    "description": "",
    "items": {
        "type": "object",
        "key": "messages",
        "sort": 0,
        "title": "历史消息",
        "description": "",
        "items": null,
        "required": [
            "role",
            "content"
        ],
        "value": null,
        "properties": {
            "role": {
                "type": "string",
                "key": "role",
                "sort": 0,
                "title": "角色",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "content": {
                "type": "string",
                "key": "content",
                "sort": 1,
                "title": "内容",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
}
JSON,
                true
            ))?->jsonSerialize(),
        ];
        if ($this->isLoadAgentPlugin) {
            foreach (AgentPluginCollector::list() as $plugin) {
                $agentPlugin = $plugin->createAgentPlugin();
                $params = array_merge($agentPlugin->getParamsTemplate(), $params);
            }
        }
        $this->node->setParams($params);

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form, Json::decode(
            <<<'JSON'
    {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "text",
            "use_tools"
        ],
        "properties": {
            "text": {
                "type": "string",
                "key": "text",
                "sort": 0,
                "title": "LLM 响应文本",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "use_tools": {
                "type": "array",
                "key": "use_tools",
                "sort": 0,
                "title": "使用到的工具",
                "description": "",
                "items": {
                    "type": "object",
                    "key": "",
                    "sort": 0,
                    "title": "工具详情",
                    "description": "",
                    "items": null,
                    "properties": {
                        "tool_name": {
                            "type": "string",
                            "key": "tool_name",
                            "sort": 0,
                            "title": "工具名称",
                            "description": "",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "value": null
                        },
                        "success": {
                            "type": "boolean",
                            "key": "success",
                            "sort": 1,
                            "title": "是否成功",
                            "description": "",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "value": null
                        },
                        "error_message": {
                            "type": "string",
                            "key": "error_message",
                            "sort": 2,
                            "title": "错误信息",
                            "description": "",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "value": null
                        },
                        "arguments": {
                            "type": "object",
                            "key": "arguments",
                            "sort": 3,
                            "title": "工具参数",
                            "description": "",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "value": null
                        },
                        "call_result": {
                            "type": "string",
                            "key": "call_result",
                            "sort": 4,
                            "title": "调用结果",
                            "description": "",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "value": null
                        },
                        "elapsed_time": {
                            "type": "string",
                            "key": "elapsed_time",
                            "sort": 5,
                            "title": "耗时",
                            "description": "",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "value": null
                        }
                    },
                    "required": null,
                    "value": null
                },
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
JSON
        )));
        $this->node->setOutput($output);
    }
}
