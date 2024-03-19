<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine;

use Dtyq\FlowExprEngine\Component;

class TopicConfig
{
    /**
     * @var string assigned_topic 指定话题 / recent_topic 最近话题
     */
    private string $type;

    private ?Component $name;

    public function __construct(string $type, ?Component $name = null)
    {
        $this->type = $type;
        $this->name = $name;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getName(): ?Component
    {
        return $this->name;
    }

    public function toConfigArray(): array
    {
        return [
            'type' => $this->type,
            'name' => $this->name?->toArray(),
        ];
    }
}
