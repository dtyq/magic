<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\BuiltInMCP\SuperMagicChat;

use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Application\Flow\Service\MagicFlowExecuteAppService;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Chat\Entity\ValueObject\InstructionType;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Flow\DTO\MagicFlowApiChatDTO;
use Dtyq\PhpMcp\Server\FastMcp\Tools\RegisteredTool;
use Dtyq\PhpMcp\Types\Tools\Tool;
use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;

class SuperMagicChatManager
{
    private const string REDIS_KEY_PREFIX = 'super_magic_chat_manager:';

    private const int REDIS_KEY_TTL = 7200;

    public static function createByChatParams(MCPDataIsolation $MCPDataIsolation, string $mcpServerCode, array $agentIds = [], array $toolIds = []): void
    {
        $redis = self::getRedis();
        $key = self::buildRedisKey($mcpServerCode);

        $data = [
            'organization_code' => $MCPDataIsolation->getCurrentOrganizationCode(),
            'user_id' => $MCPDataIsolation->getCurrentUserId(),
            'agent_ids' => $agentIds,
            'tool_ids' => $toolIds,
            'created_at' => time(),
        ];

        $redis->setex($key, self::REDIS_KEY_TTL, json_encode($data));
    }

    public static function getRegisteredTools(string $mcpServerCode): array
    {
        $redis = self::getRedis();
        $key = self::buildRedisKey($mcpServerCode);

        $data = $redis->get($key);

        if (! $data) {
            return [];
        }

        $decodedData = json_decode($data, true);

        if (! $decodedData || ! is_array($decodedData)) {
            return [];
        }

        $organizationCode = $decodedData['organization_code'] ?? '';
        $userId = $decodedData['user_id'] ?? '';
        $flowDataIsolation = FlowDataIsolation::create($organizationCode, $userId);

        $agents = self::getAgents($flowDataIsolation, $decodedData['agent_ids'] ?? []);
        $tools = self::getTools($flowDataIsolation, $decodedData['tool_ids'] ?? []);

        return array_merge($tools, $agents);
    }

    /**
     * @return array<RegisteredTool>
     */
    private static function getAgents(FlowDataIsolation $flowDataIsolation, array $agentIds): array
    {
        // 1. 查询所有可用 agent
        $agents = di(MagicAgentDomainService::class)->getAgentByIds($agentIds);

        // 如果没有可用的 agents，直接返回空数组
        if (empty($agents)) {
            return [];
        }

        $hasAgents = false;
        $allInstructions = [];

        // 2. 生成一份大模型调用工具可阅读的描述
        $description = <<<'MARKDOWN'
调用麦吉 AI 助理进行对话

可用的 AI 助理列表：

MARKDOWN;

        foreach ($agents as $agent) {
            if (! $agent->isAvailable()) {
                continue;
            }
            $instruction = $agent->getInstructs();
            $instructionDescription = self::parseInstructionDescription($instruction);
            $description .= sprintf(
                "• ID: %s\n  名称: %s\n  描述: %s%s\n\n",
                $agent->getId(),
                $agent->getAgentName(),
                $agent->getAgentDescription() ?: '暂无描述',
                $instructionDescription ? "\n  可用指令: {$instructionDescription}" : ''
            );

            // 收集所有指令信息用于生成 schema
            if ($instruction) {
                $allInstructions[$agent->getId()] = $instruction;
            }

            $hasAgents = true;
        }

        $usageInstructions = <<<'MARKDOWN'
使用说明：
• 必须提供 agent_id 和 message 参数
• conversation_id 用于保持对话连续性，相同ID的消息会共享上下文

MARKDOWN;

        $description .= $usageInstructions;

        // 添加指令参数说明
        if (! empty($allInstructions)) {
            $instructionHelp = <<<'MARKDOWN'
指令参数 instruction（可选）：
• 格式：[{"name": "指令名称", "value": "指令值"}, ...]
• 单选类型：从可选值中选择一个，例如 "yes", "no"
• 开关类型：只能是 "on" 或 "off"
• 如果不提供指令参数，将使用默认值

调用示例：
```json
{
  "agent_id": "123456",
  "message": "你好，请帮我分析一下...",
  "conversation_id": "conv_001",
  "instruction": [
    {"name": "开关", "value": "on"},
    {"name": "ok", "value": "yes"}
  ]
}
```

MARKDOWN;

            $description .= $instructionHelp;
        }

        if (! $hasAgents) {
            return [];
        }

        // 生成指令的 JSON Schema
        $instructionSchema = self::generateInstructionSchema($allInstructions);

        $registeredAgent = new RegisteredTool(
            tool: new Tool(
                name: 'call_magic_agent',
                inputSchema: [
                    'type' => 'object',
                    'properties' => [
                        'agent_id' => [
                            'type' => 'string',
                            'description' => '要调用的 AI 助理 ID',
                        ],
                        'message' => [
                            'type' => 'string',
                            'description' => '发送给 AI 助理的消息内容',
                        ],
                        'conversation_id' => [
                            'type' => 'string',
                            'description' => '会话ID，用于记忆功能，相同会话ID的消息将具有共享的上下文',
                        ],
                        'instruction' => $instructionSchema,
                    ],
                    'required' => ['agent_id', 'message'],
                    'additionalProperties' => false,
                ],
                description: $description,
            ),
            callable: function (array $arguments) use ($flowDataIsolation) {
                $agentId = $arguments['agent_id'] ?? null;
                if (! $agentId) {
                    ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.required', ['label' => 'agent_id']);
                }
                $message = $arguments['message'] ?? null;
                if (! $message) {
                    ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.required', ['label' => 'message']);
                }
                $agent = di(MagicAgentDomainService::class)->getAgentById($agentId);
                if (! $agent) {
                    ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.not_found', ['label' => $agentId]);
                }
                $apiChatDTO = new MagicFlowApiChatDTO();
                $apiChatDTO->setFlowCode($agent->getFlowCode());
                $apiChatDTO->setMessage($message);
                $apiChatDTO->setConversationId($arguments['conversation_id'] ?? '');
                $apiChatDTO->setInstruction($arguments['instruction'] ?? []);
                return di(MagicFlowExecuteAppService::class)->apiChatByMCPTool($flowDataIsolation, $apiChatDTO);
            },
        );
        return [$registeredAgent];
    }

    /**
     * Parse instruction data to generate description text.
     */
    private static function parseInstructionDescription(?array $instructions): string
    {
        if (empty($instructions)) {
            return '';
        }

        $descriptions = [];
        foreach ($instructions as $group) {
            if (empty($group['items'])) {
                continue;
            }

            foreach ($group['items'] as $item) {
                if (empty($item['name']) || ($item['hidden'] ?? false)) {
                    continue;
                }

                // Only process items with instruction_type = 1
                if (($item['instruction_type'] ?? null) !== InstructionType::Flow->value) {
                    continue;
                }

                $baseDescription = $item['name'];

                // Add description if exists
                if (! empty($item['description'])) {
                    $baseDescription .= "({$item['description']})";
                }

                if ($item['type'] === 1) {
                    // Single selection
                    $values = array_column($item['values'] ?? [], 'value');
                    if (! empty($values)) {
                        $descriptions[] = "{$baseDescription}[单选: " . implode(' | ', $values) . ']';
                    }
                } elseif ($item['type'] === 2) {
                    // Switch
                    $defaultValue = $item['default_value'] ?? 'off';
                    $descriptions[] = "{$baseDescription}[开关: on/off, 默认:{$defaultValue}]";
                }
            }
        }

        return implode(', ', $descriptions);
    }

    /**
     * Generate JSON Schema for instruction parameter.
     */
    private static function generateInstructionSchema(array $allInstructions): array
    {
        $schema = [
            'type' => 'array',
            'description' => '指令参数数组，用于控制AI助理的行为。每个对象包含 name（指令名称）和 value（指令值）字段。单选类型指令需要从可选值中选择一个，开关类型指令只能是 "on" 或 "off"。',
            'items' => [
                'type' => 'object',
                'properties' => [
                    'name' => [
                        'type' => 'string',
                        'description' => '指令名称，必须与AI助理定义的指令名称完全匹配',
                    ],
                    'value' => [
                        'type' => 'string',
                        'description' => '指令值，单选类型从可选值中选择，开关类型只能是 "on" 或 "off"',
                    ],
                ],
                'required' => ['name', 'value'],
                'additionalProperties' => false,
            ],
        ];

        // 如果有具体的指令信息，生成更详细的 schema
        if (! empty($allInstructions)) {
            $examples = [];
            foreach ($allInstructions as $instructions) {
                foreach ($instructions as $group) {
                    if (empty($group['items'])) {
                        continue;
                    }

                    foreach ($group['items'] as $item) {
                        if (empty($item['name']) || ($item['hidden'] ?? false)) {
                            continue;
                        }

                        // Only process items with instruction_type = 1
                        if (($item['instruction_type'] ?? null) !== 1) {
                            continue;
                        }

                        if ($item['type'] === 1) {
                            // Single selection
                            $values = $item['values'] ?? [];
                            if (! empty($values)) {
                                $examples[] = [
                                    'name' => $item['name'],
                                    'value' => $values[0]['value'] ?? '',
                                ];
                            }
                        } elseif ($item['type'] === 2) {
                            // Switch
                            $defaultValue = $item['default_value'] ?? 'off';
                            $examples[] = [
                                'name' => $item['name'],
                                'value' => $defaultValue,
                            ];
                        }
                    }
                }
            }

            if (! empty($examples)) {
                $schema['examples'] = [array_slice($examples, 0, 3)]; // Show up to 3 examples
            }
        }

        return $schema;
    }

    /**
     * @return array<RegisteredTool>
     */
    private static function getTools(FlowDataIsolation $flowDataIsolation, array $toolIds): array
    {
        $permissionDataIsolation = PermissionDataIsolation::createByBaseDataIsolation($flowDataIsolation);
        $toolSetResources = di(OperationPermissionAppService::class)->getResourceOperationByUserIds(
            $permissionDataIsolation,
            ResourceType::ToolSet,
            [$flowDataIsolation->getCurrentUserId()]
        )[$flowDataIsolation->getCurrentUserId()] ?? [];
        $toolSetIds = array_keys($toolSetResources);

        $registeredTools = [];
        $toolFlows = ToolsExecutor::getToolFlows($flowDataIsolation, $toolIds);
        foreach ($toolFlows as $toolFlow) {
            if (! $toolFlow->hasCallback() && ! in_array($toolFlow->getToolSetId(), $toolSetIds)) {
                continue;
            }
            if (! $toolFlow->isEnabled()) {
                continue;
            }
            $toolFlowId = $toolFlow->getCode();
            if (isset($registeredTools[$toolFlow->getName()])) {
                continue;
            }

            $registeredTools[$toolFlow->getName()] = new RegisteredTool(
                tool: new Tool(
                    name: $toolFlow->getName(),
                    inputSchema: $toolFlow->getInput()?->getForm()?->getForm()?->toJsonSchema() ?? [],
                    description: $toolFlow->getDescription(),
                ),
                callable: function (array $arguments) use ($flowDataIsolation, $toolFlowId) {
                    $toolFlow = ToolsExecutor::getToolFlows($flowDataIsolation, [$toolFlowId])[0] ?? null;
                    if (! $toolFlow || ! $toolFlow->isEnabled()) {
                        $label = $toolFlow ? $toolFlow->getName() : $toolFlowId;
                        ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.disabled', ['label' => $label]);
                    }
                    $apiChatDTO = new MagicFlowApiChatDTO();
                    $apiChatDTO->setParams($arguments);
                    $apiChatDTO->setFlowCode($toolFlow->getCode());
                    $apiChatDTO->setFlowVersionCode($toolFlow->getVersionCode());
                    $apiChatDTO->setMessage('mcp_tool_call');
                    return di(MagicFlowExecuteAppService::class)->apiParamCallByRemoteTool($flowDataIsolation, $apiChatDTO, 'super_magic_mcp_tool');
                },
            );
        }

        return array_values($registeredTools);
    }

    private static function getRedis(): RedisProxy
    {
        return di(RedisFactory::class)->get('default');
    }

    private static function buildRedisKey(string $mcpServerCode): string
    {
        return self::REDIS_KEY_PREFIX . $mcpServerCode;
    }
}
