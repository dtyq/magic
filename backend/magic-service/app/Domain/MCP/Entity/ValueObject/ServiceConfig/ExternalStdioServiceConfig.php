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

    protected ?array $env = null;

    private array $allowedCommands = [
        'npx',
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
     * @return null|array<string, string>
     */
    public function getEnv(): ?array
    {
        return $this->env;
    }

    /**
     * Set environment variables.
     *
     * @param null|array<string, string> $env
     */
    public function setEnv(?array $env): void
    {
        $this->env = $env;
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
    }

    public static function fromArray(array $array): self
    {
        $instance = new self();
        $instance->setCommand($array['command'] ?? '');
        $instance->setArguments($array['arguments'] ?? []);
        $instance->setEnv($array['env'] ?? null);
        return $instance;
    }

    public function toArray(): array
    {
        return [
            'command' => $this->command,
            'arguments' => $this->arguments,
            'env' => $this->env,
        ];
    }

    public function toWebArray(): array
    {
        return [
            'command' => $this->command,
            'arguments' => implode(' ', $this->arguments),
            'env' => $this->env,
        ];
    }

    /**
     * Extract required fields from arguments only.
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

        // Extract from env values
        if (! empty($this->env)) {
            $envFields = $this->extractRequiredFieldsFromArray(array_values($this->env));
            $fields = array_merge($fields, $envFields);
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

        // Replace fields in env values
        if (! empty($this->env)) {
            $newEnv = array_map(function ($value) use ($fieldValues) {
                return $this->replaceFields($value, $fieldValues);
            }, $this->env);
            $this->setEnv($newEnv);
        }

        return $this;
    }
}
