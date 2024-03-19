<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage\Item;

use App\Domain\Chat\Entity\AbstractEntity;

/**
 * 聊天指令实体类，根据 proto 定义.
 */
class ChatInstruction extends AbstractEntity
{
    /**
     * 指令值.
     */
    protected string $value = '';

    /**
     * 指令类型.
     */
    protected ?InstructionConfig $instruction = null;

    public function __construct(array $instruction)
    {
        parent::__construct($instruction);
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function setValue(string $value): void
    {
        $this->value = $value;
    }

    public function getInstruction(): ?InstructionConfig
    {
        return $this->instruction;
    }

    public function setInstruction(null|array|InstructionConfig $instruction): void
    {
        if (isset($instruction)) {
            if (is_array($instruction)) {
                $this->instruction = new InstructionConfig($instruction);
            /* @phpstan-ignore-next-line */
            } elseif (! $instruction instanceof InstructionConfig) {
                // 如果不是数组也不是 InstructionConfig 对象，则创建一个空的 InstructionConfig 对象
                $this->instruction = new InstructionConfig([]);
            }
        } else {
            $this->instruction = null;
        }
    }
}
