<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox;

/**
 * 沙箱数据结构体.
 *
 * 对应接口返回的数据格式：
 * {
 *     "sandbox_id": "be9ae617",
 *     "status": "running/exited",
 *     "created_at": 1744293391.8599138,
 *     "ip_address": "192.168.148.10"
 * }
 */
class SandboxData
{
    /**
     * @param string $sandboxId 沙箱ID
     * @param string $status 沙箱状态，可能的值: running, exited, unknown
     * @param float $createdAt 创建时间戳
     * @param string $ipAddress IP地址
     * @param array $extraData 额外数据
     */
    public function __construct(
        private string $sandboxId = '',
        private string $status = 'unknown',
        private float $createdAt = 0,
        private string $ipAddress = '',
        private array $extraData = []
    ) {
        if ($this->createdAt == 0) {
            $this->createdAt = (float) time();
        }
    }

    /**
     * 从数组创建结构体实例.
     */
    public static function fromArray(array $data): self
    {
        $sandboxId = $data['sandbox_id'] ?? '';
        $status = $data['status'] ?? 'unknown';
        $createdAt = (float) ($data['created_at'] ?? time());
        $ipAddress = $data['ip_address'] ?? '';

        // 移除已处理的键，剩余的放入 extraData
        $extraData = $data;
        unset($extraData['sandbox_id'], $extraData['status'], $extraData['created_at'], $extraData['ip_address']);

        return new self($sandboxId, $status, $createdAt, $ipAddress, $extraData);
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'sandbox_id' => $this->sandboxId,
            'status' => $this->status,
            'created_at' => $this->createdAt,
            'ip_address' => $this->ipAddress,
        ];

        // 添加额外数据
        return array_merge($result, $this->extraData);
    }

    /**
     * 获取沙箱ID.
     */
    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    /**
     * 设置沙箱ID.
     */
    public function setSandboxId(string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }

    /**
     * 获取沙箱状态
     */
    public function getStatus(): string
    {
        return $this->status;
    }

    /**
     * 设置沙箱状态
     */
    public function setStatus(string $status): self
    {
        $this->status = $status;
        return $this;
    }

    /**
     * 获取创建时间戳.
     */
    public function getCreatedAt(): float
    {
        return $this->createdAt;
    }

    /**
     * 设置创建时间戳.
     */
    public function setCreatedAt(float $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    /**
     * 获取IP地址
     */
    public function getIpAddress(): string
    {
        return $this->ipAddress;
    }

    /**
     * 设置IP地址
     */
    public function setIpAddress(string $ipAddress): self
    {
        $this->ipAddress = $ipAddress;
        return $this;
    }

    /**
     * 获取额外数据.
     */
    public function getExtraData(): array
    {
        return $this->extraData;
    }

    /**
     * 设置额外数据.
     */
    public function setExtraData(array $extraData): self
    {
        $this->extraData = $extraData;
        return $this;
    }

    /**
     * 获取额外数据中的指定字段.
     * @param null|mixed $default
     */
    public function getExtraValue(string $key, $default = null)
    {
        return $this->extraData[$key] ?? $default;
    }

    /**
     * 设置额外数据中的指定字段.
     * @param mixed $value
     */
    public function setExtraValue(string $key, $value): self
    {
        $this->extraData[$key] = $value;
        return $this;
    }
}
