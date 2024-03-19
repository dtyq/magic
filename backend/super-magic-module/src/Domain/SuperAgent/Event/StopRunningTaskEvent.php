<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DeleteDataType;

/**
 * 停止运行中任务事件
 * 当工作区、项目或话题被删除时触发，用于异步停止相关的运行中任务
 */
class StopRunningTaskEvent extends AbstractEvent
{
    /**
     * 构造函数.
     *
     * @param DeleteDataType $dataType 数据类型（工作区、项目、话题）
     * @param int $dataId 数据ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @param string $reason 停止原因
     */
    public function __construct(
        private DeleteDataType $dataType,
        private int $dataId,
        private string $userId,
        private string $organizationCode,
        private string $reason = ''
    ) {
        // Call parent constructor to generate snowflake ID
        parent::__construct();

        // Set default reason if not provided
        if (empty($this->reason)) {
            $this->reason = "Related {$this->dataType->getDescription()} has been deleted";
        }
    }

    /**
     * 从数组创建事件.
     *
     * @param array $data 事件数据数组
     */
    public static function fromArray(array $data): self
    {
        $dataType = DeleteDataType::from($data['data_type'] ?? DeleteDataType::TOPIC->value);
        $dataId = (int) ($data['data_id'] ?? 0);
        $userId = (string) ($data['user_id'] ?? '');
        $organizationCode = (string) ($data['organization_code'] ?? '');
        $reason = (string) ($data['reason'] ?? '');

        return new self($dataType, $dataId, $userId, $organizationCode, $reason);
    }

    /**
     * 转换为数组.
     *
     * @return array 事件数据数组
     */
    public function toArray(): array
    {
        return [
            'event_id' => $this->getEventId(),
            'data_type' => $this->dataType->value,
            'data_id' => $this->dataId,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'reason' => $this->reason,
            'timestamp' => time(),
        ];
    }

    /**
     * 获取数据类型.
     */
    public function getDataType(): DeleteDataType
    {
        return $this->dataType;
    }

    /**
     * 获取数据ID.
     */
    public function getDataId(): int
    {
        return $this->dataId;
    }

    /**
     * 获取用户ID.
     */
    public function getUserId(): string
    {
        return $this->userId;
    }

    /**
     * 获取组织编码.
     */
    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    /**
     * 获取停止原因.
     */
    public function getReason(): string
    {
        return $this->reason;
    }
}
