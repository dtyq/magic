<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 任务状态值对象
 */
enum TaskStatus: string
{
    /**
     * 等待中.
     */
    case WAITING = 'waiting';

    /**
     * 运行中.
     */
    case RUNNING = 'running';

    /**
     * 已完成.
     */
    case FINISHED = 'finished';

    /**
     * 挂起.
     */
    case Suspended = 'suspended';

    /**
     * 终止.
     */
    case Stopped = 'stopped';

    /**
     * 错误.
     */
    case ERROR = 'error';

    /**
     * 获取状态描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::WAITING => '等待中',
            self::RUNNING => '运行中',
            self::FINISHED => '已完成',
            self::ERROR => '错误',
            self::Suspended => '挂起',
            self::Stopped => '终止',
        };
    }

    /**
     * 获取所有状态列表.
     *
     * @return array<string, string> 状态值与描述的映射
     */
    public static function getList(): array
    {
        return [
            self::WAITING->value => self::WAITING->getDescription(),
            self::RUNNING->value => self::RUNNING->getDescription(),
            self::FINISHED->value => self::FINISHED->getDescription(),
            self::ERROR->value => self::ERROR->getDescription(),
            self::Suspended->value => self::Suspended->getDescription(),
            self::Stopped->value => self::Stopped->getDescription(),
        ];
    }

    /**
     * 是否为终态
     */
    public function isFinal(): bool
    {
        return in_array($this, [self::FINISHED, self::ERROR, self::Stopped, self::Suspended], true);
    }

    /**
     * 是否为活跃状态
     */
    public function isActive(): bool
    {
        return in_array($this, [self::WAITING, self::RUNNING], true);
    }
}
