<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Component\Points\DTO;

/**
 * magic-service 对外统一的积分预估结果，供 Design 等上层接口直接组装响应。
 */
readonly class PointEstimateResult
{
    /**
     * 保存积分预估结果和计算明细；成本积分暂不对外返回。
     *
     * @param string $resourceType 预估资源类型，例如 video，便于后续扩展图片等资源
     * @param int $points 用户侧展示、余额校验和后续冻结使用的预估积分
     * @param array<string, mixed> $detail 预估计算明细，例如计费模式、估算 token 和实际计费 token
     */
    public function __construct(
        private string $resourceType,
        private int $points,
        private array $detail = [],
    ) {
    }

    /**
     * 构造不接入计费或暂不支持资源类型时的 0 积分预估结果。
     */
    public static function zero(string $resourceType): self
    {
        return new self($resourceType, 0);
    }

    /**
     * 返回本次预估对应的资源类型。
     */
    public function getResourceType(): string
    {
        return $this->resourceType;
    }

    /**
     * 返回用户侧展示或校验使用的积分数。
     */
    public function getPoints(): int
    {
        return $this->points;
    }

    /**
     * 返回预估明细，例如 token 数、计费模式等。
     *
     * @return array<string, mixed>
     */
    public function getDetail(): array
    {
        return $this->detail;
    }

    /**
     * 转换为接口响应数组。
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'resource_type' => $this->resourceType,
            'points' => $this->points,
            'detail' => $this->detail,
        ];
    }
}
