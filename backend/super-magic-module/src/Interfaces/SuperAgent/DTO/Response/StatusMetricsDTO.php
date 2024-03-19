<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class StatusMetricsDTO extends AbstractDTO
{
    /**
     * @var int 错误状态的话题数量
     */
    protected int $errorCount = 0;

    /**
     * @var int 完成状态的话题数量
     */
    protected int $completedCount = 0;

    /**
     * @var int 运行中状态的话题数量
     */
    protected int $runningCount = 0;

    /**
     * @var int 等待中状态的话题数量
     */
    protected int $waitingCount = 0;

    /**
     * @var int 已暂停状态的话题数量
     */
    protected int $pausedCount = 0;

    /**
     * 获取错误状态的话题数量.
     */
    public function getErrorCount(): int
    {
        return $this->errorCount;
    }

    /**
     * 设置错误状态的话题数量.
     */
    public function setErrorCount(int $errorCount): self
    {
        $this->errorCount = $errorCount;
        return $this;
    }

    /**
     * 获取完成状态的话题数量.
     */
    public function getCompletedCount(): int
    {
        return $this->completedCount;
    }

    /**
     * 设置完成状态的话题数量.
     */
    public function setCompletedCount(int $completedCount): self
    {
        $this->completedCount = $completedCount;
        return $this;
    }

    /**
     * 获取运行中状态的话题数量.
     */
    public function getRunningCount(): int
    {
        return $this->runningCount;
    }

    /**
     * 设置运行中状态的话题数量.
     */
    public function setRunningCount(int $runningCount): self
    {
        $this->runningCount = $runningCount;
        return $this;
    }

    /**
     * 获取等待中状态的话题数量.
     */
    public function getWaitingCount(): int
    {
        return $this->waitingCount;
    }

    /**
     * 设置等待中状态的话题数量.
     */
    public function setWaitingCount(int $waitingCount): self
    {
        $this->waitingCount = $waitingCount;
        return $this;
    }

    /**
     * 获取已暂停状态的话题数量.
     */
    public function getPausedCount(): int
    {
        return $this->pausedCount;
    }

    /**
     * 设置已暂停状态的话题数量.
     */
    public function setPausedCount(int $pausedCount): self
    {
        $this->pausedCount = $pausedCount;
        return $this;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'error_count' => $this->errorCount,
            'completed_count' => $this->completedCount,
            'running_count' => $this->runningCount,
            'waiting_count' => $this->waitingCount,
            'paused_count' => $this->pausedCount,
        ];
    }
}
