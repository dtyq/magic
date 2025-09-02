<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Application\Flow\Service\MagicFlowExecuteAppService;
use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\ToolSource;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\MCP\Tools\MCPTool;
use App\Interfaces\Flow\DTO\MagicFlowApiChatDTO;
use Qbhy\HyperfAuth\Authenticatable;

class MCPServerSSEAppService extends AbstractMCPAppService
{
    /**
     * @return array<MCPTool>
     */
    public function getTools(Authenticatable $authorization, string $mcpServerCode): array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);
        $operation = $this->getMCPServerOperation($dataIsolation, $mcpServerCode);
        $operation->validate('r', $mcpServerCode);

        $mcpTools = [];

        $mcpServer = $this->mcpServerDomainService->getByCode($dataIsolation, $mcpServerCode);
        if (! $mcpServer || ! $mcpServer->isEnabled()) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.not_found', ['label' => $mcpServerCode]);
        }

        $mcpServerTools = $this->mcpServerToolDomainService->getByMcpServerCodes($dataIsolation, [$mcpServerCode]);

        foreach ($mcpServerTools as $mcpServerTool) {
            if (! $mcpServerTool->isEnabled()) {
                continue;
            }
            $callback = $this->getToolExecutorCallback($dataIsolation, $mcpServerTool);
            if (! $callback) {
                continue;
            }
            $mcpTools[] = new MCPTool(
                name: $mcpServerTool->getOptions()->getName(),
                description: $mcpServerTool->getOptions()->getDescription(),
                jsonSchema: $mcpServerTool->getOptions()->getInputSchema(),
                callback: $callback
            );
        }

        return $mcpTools;
    }

    private function getToolExecutorCallback(MCPDataIsolation $dataIsolation, MCPServerToolEntity $MCPServerToolEntity): ?callable
    {
        return match ($MCPServerToolEntity->getSource()) {
            ToolSource::FlowTool => function (array $arguments) use ($dataIsolation, $MCPServerToolEntity) {
                $flowDataIsolation = $this->createFlowDataIsolation($dataIsolation);
                $apiChatDTO = new MagicFlowApiChatDTO();
                $apiChatDTO->setParams($arguments);
                $apiChatDTO->setFlowCode($MCPServerToolEntity->getRelCode());
                $apiChatDTO->setFlowVersionCode($MCPServerToolEntity->getRelVersionCode());
                $apiChatDTO->setMessage('mcp_tool_call');
                return di(MagicFlowExecuteAppService::class)->apiParamCallByRemoteTool($flowDataIsolation, $apiChatDTO, 'mcp_tool');
            },
            default => null,
        };
    }
}
