<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class TopicMetricsResponseDTO extends AbstractDTO
{
    /**
     * @var StatusMetricsDTO 状态指标数据
     */
    protected StatusMetricsDTO $statusMetrics;

    /**
     * @var TotalMetricsDTO 总计指标数据
     */
    protected TotalMetricsDTO $totalMetrics;

    /**
     * 获取状态指标.
     */
    public function getStatusMetrics(): StatusMetricsDTO
    {
        return $this->statusMetrics;
    }

    /**
     * 设置状态指标.
     */
    public function setStatusMetrics(StatusMetricsDTO $statusMetrics): self
    {
        $this->statusMetrics = $statusMetrics;
        return $this;
    }

    /**
     * 获取总计指标.
     */
    public function getTotalMetrics(): TotalMetricsDTO
    {
        return $this->totalMetrics;
    }

    /**
     * 设置总计指标.
     */
    public function setTotalMetrics(TotalMetricsDTO $totalMetrics): self
    {
        $this->totalMetrics = $totalMetrics;
        return $this;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'status_metrics' => $this->statusMetrics->toArray(),
            'total_metrics' => $this->totalMetrics->toArray(),
        ];
    }
}
