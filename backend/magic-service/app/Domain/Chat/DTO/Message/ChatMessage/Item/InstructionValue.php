<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage\Item;

use App\Domain\Chat\Entity\AbstractEntity;

/**
 * 指令选项值实体类，根据 proto 定义.
 */
class InstructionValue extends AbstractEntity
{
    /**
     * 选项ID.
     */
    protected string $id = '';

    /**
     * 选项的显示名称.
     */
    protected string $name = '';

    /**
     * 选项的值.
     */
    protected string $value = '';

    public function __construct(array $value)
    {
        parent::__construct($value);
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function setValue(string $value): void
    {
        $this->value = $value;
    }
}
