<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\AbstractSandbox;
use Hyperf\Logger\LoggerFactory;

/**
 * SandboxOS Base Abstract Class
 * Provides shared infrastructure for SandboxOS Gateway and Agent modules.
 */
abstract class AbstractSandboxOS extends AbstractSandbox
{
    public function __construct(LoggerFactory $loggerFactory)
    {
        parent::__construct($loggerFactory);
        // Initialize HTTP client
        $this->initializeClient();
    }

    /**
     * Get authentication header information
     * Uses X-Sandbox-Gateway header according to sandbox communication documentation.
     */
    protected function getAuthHeaders(): array
    {
        return [
            'X-Sandbox-Gateway' => $this->token,
            'Content-Type' => 'application/json',
        ];
    }

    /**
     * Build complete API path.
     */
    protected function buildApiPath(string $path): string
    {
        return ltrim($path, '/');
    }

    /**
     * Build sandbox proxy path.
     */
    protected function buildProxyPath(string $sandboxId, string $agentPath): string
    {
        return sprintf('api/v1/sandboxes/%s/proxy/%s', $sandboxId, ltrim($agentPath, '/'));
    }
}
