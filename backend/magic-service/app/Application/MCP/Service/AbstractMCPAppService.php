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
use App\Domain\MCP\Service\MCPUserSettingDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

abstract class AbstractMCPAppService extends AbstractKernelAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected readonly MCPServerDomainService $mcpServerDomainService,
        protected readonly MCPServerToolDomainService $mcpServerToolDomainService,
        protected readonly MagicFlowDomainService $magicFlowDomainService,
        protected readonly MagicFlowVersionDomainService $magicFlowVersionDomainService,
        protected readonly OperationPermissionAppService $operationPermissionAppService,
        protected readonly MCPUserSettingDomainService $mcpUserSettingDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }
}
