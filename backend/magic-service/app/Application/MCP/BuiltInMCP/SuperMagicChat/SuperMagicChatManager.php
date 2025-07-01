<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\BuiltInMCP\SuperMagicChat;

use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Application\Flow\Service\MagicFlowExecuteAppService;
use App\Application\Permission\Service\OperationPermissionAppService;
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

        $agents = [];
        $tools = self::getTools($flowDataIsolation, $decodedData['tool_ids'] ?? []);

        return array_merge($tools, $agents);
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
