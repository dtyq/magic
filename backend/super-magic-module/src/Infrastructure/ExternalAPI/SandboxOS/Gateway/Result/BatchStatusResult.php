<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;

/**
 * 批量沙箱状态结果类
 * 专门处理批量沙箱状态查询结果.
 */
class BatchStatusResult extends GatewayResult
{
    private array $sandboxStatuses = [];

    /**
     * 从API响应创建批量状态结果.
     */
    public static function fromApiResponse(array $response): self
    {
        $result = new self(
            $response['code'] ?? 2000,
            $response['message'] ?? 'Unknown error',
            $response['data'] ?? []
        );

        // 解析批量状态数据
        // 根据文档，data 字段直接是沙箱状态数组
        $data = $response['data'] ?? [];
        if (is_array($data)) {
            $result->sandboxStatuses = $data;
        }

        return $result;
    }

    /**
     * 获取所有沙箱状态
     */
    public function getSandboxStatuses(): array
    {
        return $this->sandboxStatuses ?: $this->getData();
    }

    /**
     * 获取指定沙箱的状态
     */
    public function getSandboxStatus(string $sandboxId): ?string
    {
        $statuses = $this->getSandboxStatuses();

        foreach ($statuses as $sandbox) {
            if (isset($sandbox['sandbox_id']) && $sandbox['sandbox_id'] === $sandboxId) {
                return $sandbox['status'] ?? null;
            }
        }

        return null;
    }

    /**
     * 检查指定沙箱是否运行中.
     */
    public function isSandboxRunning(string $sandboxId): bool
    {
        $status = $this->getSandboxStatus($sandboxId);
        return $status !== null && SandboxStatus::isAvailable($status);
    }

    /**
     * 获取运行中的沙箱列表.
     */
    public function getRunningSandboxes(): array
    {
        $running = [];
        $statuses = $this->getSandboxStatuses();

        foreach ($statuses as $sandbox) {
            if (isset($sandbox['status']) && SandboxStatus::isAvailable($sandbox['status'])) {
                $running[] = $sandbox;
            }
        }

        return $running;
    }

    /**
     * 获取运行中的沙箱ID列表.
     */
    public function getRunningSandboxIds(): array
    {
        $ids = [];
        $running = $this->getRunningSandboxes();

        foreach ($running as $sandbox) {
            if (isset($sandbox['sandbox_id'])) {
                $ids[] = $sandbox['sandbox_id'];
            }
        }

        return $ids;
    }

    /**
     * 获取沙箱总数.
     */
    public function getTotalCount(): int
    {
        return count($this->getSandboxStatuses());
    }

    /**
     * 获取运行中沙箱数量.
     */
    public function getRunningCount(): int
    {
        return count($this->getRunningSandboxes());
    }
}
