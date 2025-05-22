<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

class ToolOptions extends AbstractValueObject
{
    /**
     * 工具名称.
     */
    protected string $name;

    /**
     * 工具描述.
     */
    protected string $description;

    /**
     * 输入模式定义.
     */
    protected array $inputSchema = [];

    public function __construct(string $name = '', string $description = '', array $inputSchema = [])
    {
        $this->name = $name;
        $this->description = $description;
        $this->inputSchema = $inputSchema;
        parent::__construct();
    }

    /**
     * 从数组创建实例.
     */
    public static function fromArray(?array $data): self
    {
        if (empty($data)) {
            return new self();
        }

        return new self(
            $data['name'] ?? '',
            $data['description'] ?? '',
            $data['input_schema'] ?? []
        );
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getInputSchema(): array
    {
        return $this->inputSchema;
    }

    public function setInputSchema(array $inputSchema): void
    {
        $this->inputSchema = $inputSchema;
    }
}
