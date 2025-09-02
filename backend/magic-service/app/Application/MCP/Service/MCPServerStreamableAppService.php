<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Application\Flow\Service\MagicFlowExecuteAppService;
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
use Dtyq\PhpMcp\Types\Tools\Tool;
use Qbhy\HyperfAuth\Authenticatable;

class MCPServerStreamableAppService extends AbstractMCPAppService
{
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
            $callback = $this->getToolExecutorCallback($flowDataIsolation, $mcpServerTool);
            if (! $callback) {
                continue;
            }
            $tool = new Tool(
                name: $mcpServerTool->getName(),
                inputSchema: $mcpServerTool->getOptions()->getInputSchema(),
                description: $mcpServerTool->getDescription(),
            );
            $mcpTools[] = new RegisteredTool($tool, $callback);
        }

        return $mcpTools;
    }

    private function getToolExecutorCallback(FlowDataIsolation $flowDataIsolation, MCPServerToolEntity $MCPServerToolEntity): ?callable
    {
        $toolId = $MCPServerToolEntity->getId();
        return match ($MCPServerToolEntity->getSource()) {
            ToolSource::FlowTool => function (array $arguments) use ($flowDataIsolation, $toolId) {
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
            },
            default => null,
        };
    }
}
