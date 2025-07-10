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

        // 2. 生成一份大模型调用工具可阅读的描述
        $description = '调用麦吉 AI 助理进行对话。可用的 AI 助理列表：\n';
        foreach ($agents as $agent) {
            if (! $agent->isAvailable()) {
                continue;
            }
            $description .= sprintf(
                "- ID: %s | 名称: %s | 描述: %s\n",
                $agent->getId(),
                $agent->getAgentName(),
                $agent->getAgentDescription() ?: '暂无描述'
            );
            $hasAgents = true;
        }
        $description .= '使用时请提供对应的 agent_id 和要发送的消息内容。';

        if (! $hasAgents) {
            return [];
        }

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
                return di(MagicFlowExecuteAppService::class)->apiChatByMCPTool($flowDataIsolation, $apiChatDTO);
            },
        );
        return [$registeredAgent];
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
                    return di(MagicFlowExecuteAppService::class)->apiParamCallByMCPTool($flowDataIsolation, $apiChatDTO);
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
