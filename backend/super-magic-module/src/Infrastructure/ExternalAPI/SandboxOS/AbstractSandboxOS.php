<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS;

use GuzzleHttp\Client;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * SandboxOS Base Abstract Class
 * Provides shared infrastructure for SandboxOS Gateway and Agent modules.
 * This class is independent and does not depend on the Sandbox package.
 */
abstract class AbstractSandboxOS
{
    protected Client $client;

    protected LoggerInterface $logger;

    protected string $baseUrl = '';

    protected string $token = '';

    protected bool $enableSandbox = true;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get('sandbox');
        // Initialize HTTP client
        $this->initializeClient();
    }

    /**
     * Initialize HTTP client with configuration.
     */
    protected function initializeClient(): void
    {
        $this->baseUrl = config('super-magic.sandbox.gateway', '');
        $this->token = config('super-magic.sandbox.token', '');
        $this->enableSandbox = config('super-magic.sandbox.enabled', true);

        if (empty($this->baseUrl)) {
            throw new RuntimeException('SANDBOX_GATEWAY environment variable is not set');
        }

        $this->client = new Client([
            'base_uri' => $this->baseUrl,
            'timeout' => 30,
            'http_errors' => false,
        ]);
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
