<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 任务事件枚举.
 */
enum TaskEvent: string
{
    /**
     * 任务挂起.
     */
    case SUSPENDED = 'suspended';

    /**
     * 任务终止.
     */
    case TERMINATED = 'terminated';

    /**
     * 获取事件描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::SUSPENDED => '任务挂起',
            self::TERMINATED => '任务终止',
        };
    }

    /**
     * 是否为挂起状态
     */
    public function isSuspended(): bool
    {
        return $this === self::SUSPENDED;
    }

    /**
     * 是否为终止状态
     */
    public function isTerminated(): bool
    {
        return $this === self::TERMINATED;
    }
}
