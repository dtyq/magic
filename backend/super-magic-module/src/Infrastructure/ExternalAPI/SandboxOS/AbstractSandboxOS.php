<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS;

use GuzzleHttp\Client;
use Hyperf\Context\ApplicationContext;
use Hyperf\Guzzle\ClientFactory;
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
    protected LoggerInterface $logger;

    protected string $baseUrl = '';

    protected string $token = '';

    protected bool $enableSandbox = true;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get('sandbox');
    }

    /**
     * Get HTTP client with proper connection management for long-running processes.
     */
    protected function getClient(): Client
    {
        // Always create a fresh client using Hyperf's ClientFactory for better connection management
        $clientFactory = ApplicationContext::getContainer()->get(ClientFactory::class);

        return $clientFactory->create([
            'base_uri' => $this->getBaseUrl(),
            'timeout' => 30,
            'http_errors' => false,
        ]);
    }

    /**
     * Get base URL with lazy initialization.
     */
    protected function getBaseUrl(): string
    {
        if (empty($this->baseUrl)) {
            $this->baseUrl = config('super-magic.sandbox.gateway', '');
            if (empty($this->baseUrl)) {
                throw new RuntimeException('SANDBOX_GATEWAY environment variable is not set');
            }
        }
        return $this->baseUrl;
    }

    /**
     * Get token with lazy initialization.
     */
    protected function getToken(): string
    {
        if (empty($this->token)) {
            $this->token = config('super-magic.sandbox.token', '');
        }
        return $this->token;
    }

    /**
     * Get sandbox enabled status with lazy initialization.
     */
    protected function isEnabledSandbox(): bool
    {
        $this->enableSandbox = config('super-magic.sandbox.enabled', true);
        return $this->enableSandbox;
    }

    /**
     * Get authentication header information
     * Uses X-Sandbox-Gateway header according to sandbox communication documentation.
     */
    protected function getAuthHeaders(): array
    {
        return [
            'X-Sandbox-Gateway' => $this->getToken(),
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
