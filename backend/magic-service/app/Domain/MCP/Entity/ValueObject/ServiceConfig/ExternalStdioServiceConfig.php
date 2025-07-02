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

    public function getCommand(): string
    {
        return $this->command;
    }

    public function setCommand(string $command): void
    {
        $this->command = $command;
    }

    public function getArguments(): array
    {
        return $this->arguments;
    }

    public function setArguments(array $arguments): void
    {
        $this->arguments = $arguments;
    }

    public function validate(): void
    {
        if (empty(trim($this->command))) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.command']);
        }

        if (empty($this->arguments)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.arguments']);
        }
    }

    public static function fromArray(array $array): ServiceConfigInterface
    {
        $instance = new self();
        $instance->setCommand($array['command'] ?? '');
        $instance->setArguments($array['arguments'] ?? []);
        return $instance;
    }

    public function toArray(): array
    {
        return [
            'command' => $this->command,
            'arguments' => $this->arguments,
        ];
    }
}
