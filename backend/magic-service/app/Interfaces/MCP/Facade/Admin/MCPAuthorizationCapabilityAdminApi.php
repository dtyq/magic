<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\Admin;

use App\Application\MCP\Authorization\MCPAuthorizationAppService;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\MCP\Assembler\MCPServerAssembler;
use App\Interfaces\MCP\DTO\MCPServerDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

/**
 * MCP Authorization 能力探测接口。
 */
#[ApiResponse(version: 'low_code')]
class MCPAuthorizationCapabilityAdminApi extends AbstractMCPAdminApi
{
    #[Inject]
    protected MCPAuthorizationAppService $authorizationAppService;

    /**
     * 探测前端当前编辑中的 MCP Server 配置，不保存任何数据。
     *
     * @return array<string, mixed>
     */
    public function analyze(): array
    {
        $this->getAuthorization();
        $requestData = $this->request->all();
        if (empty($requestData['type'])) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'type']);
        }
        if (! isset($requestData['service_config']) || ! is_array($requestData['service_config'])) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.invalid', ['label' => 'service_config']);
        }

        $dto = new MCPServerDTO($requestData);
        $mcpServer = MCPServerAssembler::createDO($dto);

        return $this->authorizationAppService->analyzeCapabilities($mcpServer);
    }
}
