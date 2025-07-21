<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Utils\MCPExecutor;

use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\PythonExecutorInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\PhpMcp\Client\McpClient;
use Dtyq\PhpMcp\Shared\Kernel\Application;
use Dtyq\PhpMcp\Types\Responses\ListToolsResult;
use Dtyq\PhpMcp\Types\Tools\Tool;
use Hyperf\Context\ApplicationContext;
use Hyperf\Odin\Mcp\McpServerConfig;
use Hyperf\Odin\Mcp\McpType;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class ExternalStdioExecutor implements ExternalStdioExecutorInterface
{
    private LoggerInterface $logger;

    private ContainerInterface $container;

    private array $allowedCommands = [
        'npx', 'uvx', 'node', 'python',
    ];

    private bool $canExecute;

    private ?PythonExecutorInterface $pythonExecutor = null;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
        $this->container = ApplicationContext::getContainer();
        $this->canExecute = (bool) \Hyperf\Support\env('MCP_STDIO_EXECUTOR', false);
        if ($this->container->has(PythonExecutorInterface::class)) {
            $this->pythonExecutor = $this->container->get(PythonExecutorInterface::class);
            $this->canExecute = true;
        }
    }

    public function getListToolsResult(McpServerConfig $mcpServerConfig): ?ListToolsResult
    {
        if (! $this->canExecute) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'mcp.server.not_support_check_status');
        }

        if ($mcpServerConfig->getType() !== McpType::Stdio) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'mcp.server.not_support_check_status');
        }

        if ($this->pythonExecutor) {
            // 使用 python 代码来执行
            return $this->getListToolsResultByPython($mcpServerConfig);
        }

        try {
            $originalCommand = $mcpServerConfig->getCommand();
            $resolvedCommand = $this->resolveCommandPath($originalCommand);
            $args = $mcpServerConfig->getArgs() ?? [];
            $env = $mcpServerConfig->getEnv() ?? [];

            $this->logger->info('MCPStdioExecutorAttempt', [
                'server_name' => $mcpServerConfig->getName(),
                'command' => $originalCommand,
                'resolved_command' => $resolvedCommand,
                'args' => $args,
                'env_count' => count($env),
                'cwd' => getcwd(),
            ]);

            // Create MCP application and client for STDIO communication
            $app = new Application($this->container, [
                'sdk_name' => 'external-stdio-client',
                'sdk_version' => '1.0.0',
            ]);

            $client = new McpClient('external-stdio-client', '1.0.0', $app);

            // Connect using STDIO transport with environment variables
            // Security: Force override PATH to prevent users from providing malicious paths
            $envVars = $env;

            // Always override PATH - never trust user-provided PATH for security
            $envVars['PATH'] = $_ENV['PATH'] ?? $_SERVER['PATH'] ?? getenv('PATH') ?: '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin';

            $session = $client->connect('stdio', [
                'command' => $resolvedCommand,
                'args' => $args,
                'env' => $envVars,
                'cwd' => getcwd(), // Use current working directory
                'timeout' => 30,
            ]);

            // Initialize the session
            $session->initialize();

            // List available tools
            $result = $session->listTools();

            $this->logger->info('MCPStdioExecutorSuccess', [
                'server_name' => $mcpServerConfig->getName(),
                'command' => $originalCommand,
                'resolved_command' => $resolvedCommand,
                'tools_count' => count($result->getTools() ?? []),
            ]);

            return $result;
        } catch (Throwable $e) {
            $this->logger->error('MCPStdioExecutorError', [
                'server_name' => $mcpServerConfig->getName(),
                'command' => $originalCommand ?? 'unknown',
                'resolved_command' => $resolvedCommand ?? 'unknown',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Throw exception instead of returning null
            ExceptionBuilder::throw(
                MCPErrorCode::ExecutorStdioConnectionFailed,
                $e->getMessage()
            );
        }
    }

    /**
     * Resolve the full path of a command with security checks.
     */
    private function resolveCommandPath(string $command): string
    {
        // Security: PRIMARY CONTROL - Whitelist of allowed commands to prevent arbitrary command execution
        if (! in_array($command, $this->allowedCommands, true)) {
            $this->logger->warning('MCPStdioExecutorUnauthorizedCommand', [
                'command' => $command,
                'allowed_commands' => $this->allowedCommands,
            ]);
            // Fail fast - throw exception immediately for unauthorized commands
            ExceptionBuilder::throw(MCPErrorCode::ExecutorStdioAccessDenied);
        }

        // Security: Only allow alphanumeric characters, hyphens, underscores, and dots
        if (! preg_match('/^[a-zA-Z0-9._-]+$/', $command)) {
            $this->logger->warning('MCPStdioExecutorInvalidCommand', [
                'command' => $command,
                'reason' => 'Contains invalid characters',
            ]);
            // Fail fast - throw exception immediately for invalid command format
            ExceptionBuilder::throw(MCPErrorCode::ExecutorStdioAccessDenied);
        }

        // Check predefined safe paths only - no shell execution
        $safePaths = $this->getSafeCommandPaths($command);
        foreach ($safePaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                return $path;
            }
        }

        // Fallback: return original command name, let system PATH resolve it
        // This is safe because we've already validated the command against our whitelist
        return $command;
    }

    /**
     * Get predefined safe paths for specific commands.
     */
    private function getSafeCommandPaths(string $command): array
    {
        $pathMap = [
            'npx' => [
                '/opt/homebrew/bin/npx',                           // Homebrew on Apple Silicon
                '/usr/local/bin/npx',                              // Homebrew on Intel Mac
                '/usr/bin/npx',                                    // System installation
            ],
            'node' => [
                '/opt/homebrew/bin/node',                          // Homebrew on Apple Silicon
                '/usr/local/bin/node',                             // Homebrew on Intel Mac
                '/usr/bin/node',                                   // System installation
            ],
        ];

        return $pathMap[$command] ?? [];
    }

    private function getListToolsResultByPython(McpServerConfig $mcpServerConfig): ?ListToolsResult
    {
        try {
            $this->logger->info('MCPPythonExecutorAttempt', [
                'server_name' => $mcpServerConfig->getName(),
                'command' => $mcpServerConfig->getCommand(),
                'args' => $mcpServerConfig->getArgs() ?? [],
                'env_count' => count($mcpServerConfig->getEnv() ?? []),
            ]);

            // Prepare source data for Python execution
            $sourceData = [
                'command' => $mcpServerConfig->getCommand(),
                'args' => $mcpServerConfig->getArgs() ?? [],
                'env_vars' => $mcpServerConfig->getEnv() ?? [],
            ];

            // Generate Python code
            $python = $this->generatePythonCode();

            // Execute Python code with source data
            $executeResult = $this->pythonExecutor->execute('', $python, $sourceData);
            $result = $executeResult->getResult();

            // Convert result to string if needed
            if (is_string($result)) {
                $resultString = $result;
            } else {
                $resultString = json_encode($result);
            }

            $this->logger->info('MCPPythonExecutorRawResult', [
                'server_name' => $mcpServerConfig->getName(),
                'result' => $resultString,
            ]);

            // Parse and convert result to ListToolsResult
            $listToolsResult = $this->parseAndConvertResult($resultString, $mcpServerConfig);

            $this->logger->info('MCPPythonExecutorSuccess', [
                'server_name' => $mcpServerConfig->getName(),
                'tools_count' => $listToolsResult ? count($listToolsResult->getTools() ?? []) : 0,
            ]);

            return $listToolsResult;
        } catch (Throwable $e) {
            $this->logger->error('MCPPythonExecutorError', [
                'server_name' => $mcpServerConfig->getName(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(
                MCPErrorCode::ExecutorStdioConnectionFailed,
                $e->getMessage()
            );
        }
    }

    /**
     * Generate Python code that uses input variables from the execution context.
     */
    private function generatePythonCode(): string
    {
        return <<<'PYTHON'
import asyncio
import json
import os

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False

async def get_mcp_tools():
    """Get tools from MCP server"""
    try:
        # Start with system environment
        env = os.environ.copy()
        
        # Add custom environment variables from config
        # The 'env_vars' variable comes from input data
        if isinstance(env_vars, dict):
            for key, value in env_vars.items():
                env[key] = value
        elif isinstance(env_vars, list) and len(env_vars) > 0:
            # Handle list format (in case it's passed as a list)
            for item in env_vars:
                if isinstance(item, dict) and 'key' in item and 'value' in item:
                    env[item['key']] = item['value']
        
        # Create server parameters
        # The 'command' and 'args' variables come from input data
        server_params = StdioServerParameters(
            command=command,
            args=args,
            env=env
        )
        
        async with stdio_client(server_params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                tools_result = await session.list_tools()
                
                if tools_result.tools:
                    tools = []
                    for tool in tools_result.tools:
                        desc = tool.description or ""
                        input_schema = None
                        
                        # Extract input schema if available
                        if hasattr(tool, 'inputSchema') and tool.inputSchema is not None:
                            try:
                                input_schema = tool.inputSchema
                            except Exception:
                                input_schema = None
                        
                        tool_info = {
                            "name": tool.name,
                            "description": desc,
                            "input_schema": input_schema
                        }
                        tools.append(tool_info)
                    
                    return {'success': True, 'tools': tools, 'count': len(tools)}
                else:
                    return {'success': True, 'tools': [], 'count': 0}
                    
    except Exception as e:
        return {'success': False, 'error': str(e), 'type': type(e).__name__}

def main():
    """Main function entry point"""
    if not MCP_AVAILABLE:
        return {'success': False, 'error': 'MCP package not installed'}
    
    try:
        result = asyncio.run(get_mcp_tools())
        return result
    except Exception as e:
        return {'success': False, 'error': str(e), 'type': type(e).__name__}

# Execute main function and print result as JSON
result = main()
print(json.dumps(result))
PYTHON;
    }

    /**
     * Parse Python execution result and convert to ListToolsResult.
     */
    private function parseAndConvertResult(string $result, McpServerConfig $mcpServerConfig): ?ListToolsResult
    {
        try {
            // Parse JSON result from Python execution
            $data = json_decode($result, true);

            // Handle different result formats
            $output = null;
            if (is_array($data)) {
                if (isset($data['__OUTPUT__'])) {
                    // Handle the __OUTPUT__ format from the execution environment
                    $outputString = $data['__OUTPUT__'];
                    if (is_string($outputString) && ! empty($outputString)) {
                        $output = json_decode($outputString, true);
                    }
                } elseif (isset($data['success'])) {
                    // Direct result format
                    $output = $data;
                }
            }

            // The result should be the direct output from Python execution
            if (! is_array($output)) {
                $this->logger->error('MCPPythonExecutorInvalidResult', [
                    'server_name' => $mcpServerConfig->getName(),
                    'result' => $result,
                    'error' => 'Invalid result format - missing success field',
                    'parsed_data' => $data,
                    'output' => $output,
                ]);
                return null;
            }

            // Handle execution errors
            if (! $output['success']) {
                $this->logger->error('MCPPythonExecutorFailure', [
                    'server_name' => $mcpServerConfig->getName(),
                    'error' => $output['error'] ?? 'Unknown error',
                    'type' => $output['type'] ?? 'Unknown',
                ]);

                ExceptionBuilder::throw(
                    MCPErrorCode::ExecutorStdioConnectionFailed,
                    $output['error'] ?? 'Python execution failed'
                );
            }

            // Convert tools to ListToolsResult
            $tools = [];
            foreach ($output['tools'] ?? [] as $toolData) {
                $tool = new Tool(
                    name: $toolData['name'] ?? '',
                    inputSchema: $toolData['input_schema'] ?? [],
                    description: $toolData['description'] ?? '',
                );

                $tools[] = $tool;
            }

            return new ListToolsResult($tools);
        } catch (Throwable $e) {
            $this->logger->error('MCPPythonExecutorParseError', [
                'server_name' => $mcpServerConfig->getName(),
                'error' => $e->getMessage(),
                'result' => $result,
                'trace' => $e->getTraceAsString(),
            ]);

            return null;
        }
    }
}
