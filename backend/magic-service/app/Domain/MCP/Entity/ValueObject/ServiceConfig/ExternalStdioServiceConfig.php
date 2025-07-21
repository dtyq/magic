<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class ExternalStdioServiceConfig extends AbstractServiceConfig
{
    protected string $command = '';

    protected array $arguments = [];

    /**
     * @var array<EnvConfig>
     */
    protected array $env = [];

    private array $allowedCommands = [
        'npx', 'uvx', 'node', 'python',
    ];

    public function getCommand(): string
    {
        return $this->command;
    }

    public function setCommand(string $command): void
    {
        $this->command = $command;
    }

    /**
     * Get environment variables.
     *
     * @return array<EnvConfig>
     */
    public function getEnv(): array
    {
        return $this->env;
    }

    /**
     * Set environment variables.
     *
     * @param array<EnvConfig> $env
     */
    public function setEnv(array $env): void
    {
        $this->env = $env;
    }

    public function addEnv(EnvConfig $env): void
    {
        $this->env[] = $env;
    }

    public function getEnvArray(): array
    {
        $envs = [];
        foreach ($this->env as $env) {
            if (! empty($env->getKey()) && ! empty($env->getValue())) {
                $envs[$env->getKey()] = $env->getValue();
            }
        }
        return $envs;
    }

    /**
     * @return array<string>
     */
    public function getArguments(): array
    {
        return $this->arguments;
    }

    /**
     * @param array<string> $arguments
     */
    public function setArguments(array|string $arguments): void
    {
        if (is_string($arguments)) {
            $arguments = explode(' ', $arguments);
        }
        $this->arguments = $arguments;
    }

    public function validate(): void
    {
        if (empty(trim($this->command))) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.command']);
        }
        if (! in_array($this->command, $this->allowedCommands, true)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'mcp.command.not_allowed', [
                'command' => $this->command,
                'allowed_commands' => implode(', ', $this->allowedCommands),
            ]);
        }

        if (empty($this->arguments)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.arguments']);
        }

        // Validate each env using its own validation method
        foreach ($this->env as $env) {
            $env->validate();
        }
    }

    public static function fromArray(array $array): self
    {
        $instance = new self();
        $instance->setCommand($array['command'] ?? '');
        $instance->setArguments($array['arguments'] ?? []);
        $instance->setEnv(array_map(
            fn (array $envData) => EnvConfig::fromArray($envData),
            $array['env'] ?? []
        ));
        return $instance;
    }

    public function toArray(): array
    {
        return [
            'command' => $this->command,
            'arguments' => $this->arguments,
            'env' => array_map(fn (EnvConfig $env) => $env->toArray(), $this->env),
        ];
    }

    public function toWebArray(): array
    {
        return [
            'command' => $this->command,
            'arguments' => implode(' ', $this->arguments),
            'env' => array_map(fn (EnvConfig $env) => $env->toArray(), $this->env),
        ];
    }

    /**
     * Extract required fields from arguments and env values.
     *
     * @return array<string> Array of field names
     */
    public function getRequireFields(): array
    {
        $fields = [];

        // Extract from arguments only
        if (! empty($this->arguments)) {
            $argumentFields = $this->extractRequiredFieldsFromArray($this->arguments);
            $fields = array_merge($fields, $argumentFields);
        }

        // Extract from env values - only process env values
        foreach ($this->env as $env) {
            $envValue = $env->getValue();
            if (! empty($envValue)) {
                $envFields = $this->extractRequiredFields($envValue);
                $fields = array_merge($fields, $envFields);
            }
        }

        return array_unique($fields);
    }

    public function replaceRequiredFields(array $fieldValues): self
    {
        // Replace fields in arguments directly
        $newArguments = [];
        foreach ($this->arguments as $argument) {
            $newArguments[] = $this->replaceFields($argument, $fieldValues);
        }
        $this->setArguments($newArguments);

        // Replace fields in env values directly
        foreach ($this->env as $env) {
            // Only replace value field, keep key and mapper_system_input unchanged
            $env->setValue($this->replaceFields($env->getValue(), $fieldValues));
        }

        return $this;
    }
}
