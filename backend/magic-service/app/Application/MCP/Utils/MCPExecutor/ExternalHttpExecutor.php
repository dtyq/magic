<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Utils\MCPExecutor;

use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\PhpMcp\Client\McpClient;
use Dtyq\PhpMcp\Shared\Kernel\Application;
use Dtyq\PhpMcp\Types\Responses\ListToolsResult;
use Hyperf\Context\ApplicationContext;
use Hyperf\Odin\Mcp\McpServerConfig;
use Hyperf\Odin\Mcp\McpType;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class ExternalHttpExecutor implements ExternalHttpExecutorInterface
{
    private LoggerInterface $logger;

    private ContainerInterface $container;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
        $this->container = ApplicationContext::getContainer();
    }

    public function getListToolsResult(McpServerConfig $mcpServerConfig): ?ListToolsResult
    {
        if ($mcpServerConfig->getType() !== McpType::Http) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'mcp.server.not_support_check_status');
        }

        try {
            $this->logger->info('MCPHttpExecutorAttempt', [
                'server_name' => $mcpServerConfig->getName(),
                'server_url' => $mcpServerConfig->getUrl(),
                'headers' => $mcpServerConfig->getHeaders() ?? [],
            ]);

            // Create MCP application and client for HTTP communication
            $app = new Application($this->container, [
                'sdk_name' => 'external-http-client',
                'sdk_version' => '1.0.0',
            ]);

            $client = new McpClient('external-http-client', '1.0.0', $app);

            // Connect using HTTP transport
            $session = $client->connect('http', [
                'base_url' => $mcpServerConfig->getUrl(),
                'headers' => $mcpServerConfig->getHeaders() ?? [],
                'timeout' => 30,
            ]);

            // Initialize the session
            $session->initialize();

            // List available tools
            $result = $session->listTools();

            $this->logger->info('MCPHttpExecutorSuccess', [
                'server_name' => $mcpServerConfig->getName(),
                'server_url' => $mcpServerConfig->getUrl(),
                'tools_count' => count($result->getTools() ?? []),
            ]);

            return $result;
        } catch (Throwable $e) {
            $this->logger->error('MCPHttpExecutorError', [
                'server_name' => $mcpServerConfig->getName(),
                'server_url' => $mcpServerConfig->getUrl(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Throw exception instead of returning null
            ExceptionBuilder::throw(
                MCPErrorCode::ExecutorHttpConnectionFailed,
                $e->getMessage()
            );
        }
    }
}
