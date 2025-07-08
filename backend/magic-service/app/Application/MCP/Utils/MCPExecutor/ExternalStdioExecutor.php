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

class ExternalStdioExecutor implements ExternalStdioExecutorInterface
{
    public function getListToolsResult(McpServerConfig $mcpServerConfig): ?ListToolsResult
    {
        return null;
    }

    //    private LoggerInterface $logger;
    //
    //    private ContainerInterface $container;
    //
    //    private array $allowedCommands = [
    //        'npx', 'node',
    //    ];
    //
    //    public function __construct(LoggerInterface $logger)
    //    {
    //        $this->logger = $logger;
    //        $this->container = ApplicationContext::getContainer();
    //    }
    //
    //    public function getListToolsResult(McpServerConfig $mcpServerConfig): ?ListToolsResult
    //    {
    //        if ($mcpServerConfig->getType() !== McpType::Stdio) {
    //            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'mcp.server.not_support_check_status');
    //        }
    //
    //        try {
    //            $originalCommand = $mcpServerConfig->getCommand();
    //            $resolvedCommand = $this->resolveCommandPath($originalCommand);
    //            $args = $mcpServerConfig->getArgs() ?? [];
    //            $env = $mcpServerConfig->getEnv() ?? [];
    //
    //            $this->logger->info('MCPStdioExecutorAttempt', [
    //                'server_name' => $mcpServerConfig->getName(),
    //                'command' => $originalCommand,
    //                'resolved_command' => $resolvedCommand,
    //                'args' => $args,
    //                'env_count' => count($env),
    //                'cwd' => getcwd(),
    //            ]);
    //
    //            // Create MCP application and client for STDIO communication
    //            $app = new Application($this->container, [
    //                'sdk_name' => 'external-stdio-client',
    //                'sdk_version' => '1.0.0',
    //            ]);
    //
    //            $client = new McpClient('external-stdio-client', '1.0.0', $app);
    //
    //            // Connect using STDIO transport with environment variables
    //            // Security: Force override PATH to prevent users from providing malicious paths
    //            $envVars = $env;
    //
    //            // Always override PATH - never trust user-provided PATH for security
    //            $envVars['PATH'] = $_ENV['PATH'] ?? $_SERVER['PATH'] ?? getenv('PATH') ?: '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin';
    //
    //            $session = $client->connect('stdio', [
    //                'command' => $resolvedCommand,
    //                'args' => $args,
    //                'env' => $envVars,
    //                'cwd' => getcwd(), // Use current working directory
    //                'timeout' => 30,
    //            ]);
    //
    //            // Initialize the session
    //            $session->initialize();
    //
    //            // List available tools
    //            $result = $session->listTools();
    //
    //            $this->logger->info('MCPStdioExecutorSuccess', [
    //                'server_name' => $mcpServerConfig->getName(),
    //                'command' => $originalCommand,
    //                'resolved_command' => $resolvedCommand,
    //                'tools_count' => count($result->getTools() ?? []),
    //            ]);
    //
    //            return $result;
    //        } catch (Throwable $e) {
    //            $this->logger->error('MCPStdioExecutorError', [
    //                'server_name' => $mcpServerConfig->getName(),
    //                'command' => $originalCommand ?? 'unknown',
    //                'resolved_command' => $resolvedCommand ?? 'unknown',
    //                'error' => $e->getMessage(),
    //                'trace' => $e->getTraceAsString(),
    //            ]);
    //
    //            // Throw exception instead of returning null
    //            ExceptionBuilder::throw(
    //                MCPErrorCode::ExecutorStdioConnectionFailed,
    //                $e->getMessage()
    //            );
    //        }
    //    }
    //
    //    /**
    //     * Resolve the full path of a command with security checks.
    //     */
    //    private function resolveCommandPath(string $command): string
    //    {
    //        // Security: PRIMARY CONTROL - Whitelist of allowed commands to prevent arbitrary command execution
    //        if (! in_array($command, $this->allowedCommands, true)) {
    //            $this->logger->warning('MCPStdioExecutorUnauthorizedCommand', [
    //                'command' => $command,
    //                'allowed_commands' => $this->allowedCommands,
    //            ]);
    //            // Fail fast - throw exception immediately for unauthorized commands
    //            ExceptionBuilder::throw(MCPErrorCode::ExecutorStdioAccessDenied);
    //        }
    //
    //        // Security: Only allow alphanumeric characters, hyphens, underscores, and dots
    //        if (! preg_match('/^[a-zA-Z0-9._-]+$/', $command)) {
    //            $this->logger->warning('MCPStdioExecutorInvalidCommand', [
    //                'command' => $command,
    //                'reason' => 'Contains invalid characters',
    //            ]);
    //            // Fail fast - throw exception immediately for invalid command format
    //            ExceptionBuilder::throw(MCPErrorCode::ExecutorStdioAccessDenied);
    //        }
    //
    //        // Check predefined safe paths only - no shell execution
    //        $safePaths = $this->getSafeCommandPaths($command);
    //        foreach ($safePaths as $path) {
    //            if (file_exists($path) && is_executable($path)) {
    //                return $path;
    //            }
    //        }
    //
    //        // Fallback: return original command name, let system PATH resolve it
    //        // This is safe because we've already validated the command against our whitelist
    //        return $command;
    //    }
    //
    //    /**
    //     * Get predefined safe paths for specific commands.
    //     */
    //    private function getSafeCommandPaths(string $command): array
    //    {
    //        $pathMap = [
    //            'npx' => [
    //                '/opt/homebrew/bin/npx',                           // Homebrew on Apple Silicon
    //                '/usr/local/bin/npx',                              // Homebrew on Intel Mac
    //                '/usr/bin/npx',                                    // System installation
    //            ],
    //            'node' => [
    //                '/opt/homebrew/bin/node',                          // Homebrew on Apple Silicon
    //                '/usr/local/bin/node',                             // Homebrew on Intel Mac
    //                '/usr/bin/node',                                   // System installation
    //            ],
    //        ];
    //
    //        return $pathMap[$command] ?? [];
    //    }
}
