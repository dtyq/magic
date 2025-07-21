<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\Admin;

use App\Application\MCP\Service\MCPOAuth2BindingAppService;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

/**
 * MCP OAuth2 Binding API.
 *
 * Handles OAuth2 service binding and unbinding requests from frontend
 */
#[ApiResponse(version: 'low_code')]
class MCPOAuth2BindingApi extends AbstractMCPAdminApi
{
    #[Inject]
    protected MCPOAuth2BindingAppService $bindingAppService;

    /**
     * Bind OAuth2 service using authorization code.
     */
    public function bind(): array
    {
        $authorization = $this->getAuthorization();

        // Get parameters from request
        $code = $this->request->input('code', '');
        $state = $this->request->input('state', '');

        // Validate required parameters
        if (empty($code)) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2BindingCodeEmpty);
        }

        if (empty($state)) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2BindingStateEmpty);
        }

        // Delegate to application service
        return $this->bindingAppService->bindOAuth2Service($authorization, $code, $state);
    }

    /**
     * Unbind OAuth2 service for the user.
     */
    public function unbind(): array
    {
        $authorization = $this->getAuthorization();

        // Get parameters from request body
        $mcpServerCode = $this->request->input('mcp_server_code', '');

        // Validate required parameters
        if (empty($mcpServerCode)) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2BindingMcpServerCodeEmpty);
        }

        // Delegate to application service
        return $this->bindingAppService->unbindOAuth2Service($authorization, $mcpServerCode);
    }
}
