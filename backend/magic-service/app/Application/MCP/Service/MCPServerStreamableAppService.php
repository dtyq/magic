<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Application\Flow\Service\MagicFlowExecuteAppService;
use App\Application\Kernel\DataIsolationSerializer;
use App\Application\MCP\BuiltInMCP\BuiltInMCPFactory;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\ToolSource;
use App\Domain\MCP\Service\MCPServerToolDomainService;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Flow\DTO\MagicFlowApiChatDTO;
use Dtyq\PhpMcp\Server\FastMcp\Tools\RegisteredTool;
use Dtyq\PhpMcp\Shared\Utilities\StaticMethodCall;
use Dtyq\PhpMcp\Types\Tools\Tool;
use Qbhy\HyperfAuth\Authenticatable;

class MCPServerStreamableAppService extends AbstractMCPAppService
{
    public static function toolExecute(array $arguments): array
    {
        // 获取内置的绑定参数
        $boundArguments = $arguments['#bound_arguments'] ?? [];
        unset($arguments['#bound_arguments']);
        $flowDataIsolationArray = $boundArguments['flowDataIsolationArray'] ?? [];
        $toolId = $boundArguments['toolId'] ?? 0;

        // Restore FlowDataIsolation from array and reinitialize environment
        /** @var FlowDataIsolation $flowDataIsolation */
        $flowDataIsolation = DataIsolationSerializer::fromArray($flowDataIsolationArray, FlowDataIsolation::class);
        $mcpDataIsolation = MCPDataIsolation::createByBaseDataIsolation($flowDataIsolation);
        $MCPServerToolEntity = di(MCPServerToolDomainService::class)->getById($mcpDataIsolation, $toolId);
        if (! $MCPServerToolEntity || ! $MCPServerToolEntity->isEnabled()) {
            $label = $MCPServerToolEntity ? (string) $MCPServerToolEntity->getName() : (string) $toolId;
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.disabled', ['label' => $label]);
        }
        $apiChatDTO = new MagicFlowApiChatDTO();
        $apiChatDTO->setParams($arguments);
        $apiChatDTO->setFlowCode($MCPServerToolEntity->getRelCode());
        $apiChatDTO->setFlowVersionCode($MCPServerToolEntity->getRelVersionCode());
        $apiChatDTO->setMessage('mcp_tool_call');
        return di(MagicFlowExecuteAppService::class)->apiParamCallByRemoteTool($flowDataIsolation, $apiChatDTO, 'mcp_tool');
    }

    /**
     * @return array<RegisteredTool>
     */
    public function getTools(Authenticatable $authorization, string $mcpServerCode): array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $builtInMCP = BuiltInMCPFactory::create($mcpServerCode);
        if ($builtInMCP) {
            return $builtInMCP->getRegisteredTools($mcpServerCode);
        }

        $allDataIsolation = clone $dataIsolation;
        $allDataIsolation->disabled();
        $mcpTools = [];
        $mcpServer = $this->mcpServerDomainService->getByCode($allDataIsolation, $mcpServerCode);
        if (! $mcpServer || ! $mcpServer->isEnabled()) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.not_found', ['label' => $mcpServerCode]);
        }
        if (! in_array($mcpServer->getOrganizationCode(), $dataIsolation->getOfficialOrganizationCodes())) {
            $operation = $this->getMCPServerOperation($dataIsolation, $mcpServerCode);
            $operation->validate('r', $mcpServerCode);
        } else {
            $dataIsolation->disabled();
        }

        $mcpServerTools = $this->mcpServerToolDomainService->getByMcpServerCodes($dataIsolation, [$mcpServerCode]);

        $flowDataIsolation = $this->createFlowDataIsolation($dataIsolation);

        foreach ($mcpServerTools as $mcpServerTool) {
            if (! $mcpServerTool->isEnabled()) {
                continue;
            }
            $staticMethodCall = $this->getToolStaticMethodCall($flowDataIsolation, $mcpServerTool);
            if (! $staticMethodCall) {
                continue;
            }
            $tool = new Tool(
                name: $mcpServerTool->getName(),
                inputSchema: $mcpServerTool->getOptions()->getInputSchema(),
                description: $mcpServerTool->getDescription(),
            );
            $mcpTools[] = new RegisteredTool($tool, staticMethod: $staticMethodCall);
        }

        return $mcpTools;
    }

    private function getToolStaticMethodCall(FlowDataIsolation $flowDataIsolation, MCPServerToolEntity $MCPServerToolEntity): ?StaticMethodCall
    {
        $toolId = $MCPServerToolEntity->getId();
        $flowDataIsolationArray = DataIsolationSerializer::toArray($flowDataIsolation);
        return match ($MCPServerToolEntity->getSource()) {
            ToolSource::FlowTool => new StaticMethodCall(self::class, 'toolExecute', [
                '#bound_arguments' => [
                    'flowDataIsolationArray' => $flowDataIsolationArray,
                    'toolId' => $toolId,
                ],
            ]),
            default => null,
        };
    }
}
