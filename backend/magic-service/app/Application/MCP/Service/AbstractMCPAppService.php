<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\Domain\Flow\Service\MagicFlowVersionDomainService;
use App\Domain\MCP\Service\MCPServerDomainService;
use App\Domain\MCP\Service\MCPServerToolDomainService;

abstract class AbstractMCPAppService extends AbstractKernelAppService
{
    public function __construct(
        protected readonly MCPServerDomainService $mcpServerDomainService,
        protected readonly MCPServerToolDomainService $mcpServerToolDomainService,
        protected readonly MagicFlowDomainService $magicFlowDomainService,
        protected readonly MagicFlowVersionDomainService $magicFlowVersionDomainService,
        protected readonly OperationPermissionAppService $operationPermissionAppService,
    ) {
    }
}
