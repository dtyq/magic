<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;

/**
 * 沙箱状态结果类
 * 专门处理单个沙箱状态查询结果.
 */
class SandboxStatusResult extends GatewayResult
{
    private ?string $sandboxId = null;

    private ?string $status = null;

    /**
     * 从API响应创建沙箱状态结果.
     */
    public static function fromApiResponse(array $response): self
    {
        $result = new self(
            $response['code'] ?? 2000,
            $response['message'] ?? 'Unknown error',
            $response['data'] ?? []
        );

        // 解析沙箱状态数据
        $data = $response['data'] ?? [];
        if (isset($data['sandbox_id'])) {
            $result->sandboxId = $data['sandbox_id'];
        }
        if (isset($data['status'])) {
            $result->status = $data['status'];
        }

        return $result;
    }

    /**
     * 获取沙箱ID.
     */
    public function getSandboxId(): ?string
    {
        return $this->sandboxId ?? $this->getDataValue('sandbox_id');
    }

    /**
     * 获取沙箱状态
     */
    public function getStatus(): ?string
    {
        return $this->status ?? $this->getDataValue('status');
    }

    /**
     * 设置沙箱ID.
     */
    public function setSandboxId(?string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }

    /**
     * 设置沙箱状态
     */
    public function setStatus(?string $status): self
    {
        $this->status = $status;
        return $this;
    }

    /**
     * 检查沙箱是否运行中.
     */
    public function isRunning(): bool
    {
        $status = $this->getStatus();
        return $status !== null && SandboxStatus::isAvailable($status);
    }

    /**
     * 检查沙箱是否待启动.
     */
    public function isPending(): bool
    {
        return $this->getStatus() === SandboxStatus::PENDING;
    }

    /**
     * 检查沙箱是否已退出.
     */
    public function isExited(): bool
    {
        return $this->getStatus() === SandboxStatus::EXITED;
    }

    /**
     * 检查状态是否有效.
     */
    public function hasValidStatus(): bool
    {
        $status = $this->getStatus();
        return $status !== null && SandboxStatus::isValidStatus($status);
    }
}
