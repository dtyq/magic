<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\DTO;

class VideoPointEstimateDTO
{
    private string $resourceType = 'video';

    private int $points = 0;

    /**
     * @var array<string, mixed>
     */
    private array $detail = [];

    /**
     * 从模型网关返回数组构建 Design 接口响应 DTO。
     *
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->setResourceType((string) ($data['resource_type'] ?? 'video'));
        $dto->setPoints((int) ($data['points'] ?? 0));
        $dto->setDetail(is_array($data['detail'] ?? null) ? $data['detail'] : []);

        return $dto;
    }

    /**
     * 返回预估资源类型。
     */
    public function getResourceType(): string
    {
        return $this->resourceType;
    }

    /**
     * 设置预估资源类型。
     */
    public function setResourceType(string $resourceType): self
    {
        $this->resourceType = $resourceType;
        return $this;
    }

    /**
     * 返回用户侧展示或余额校验使用的积分。
     */
    public function getPoints(): int
    {
        return $this->points;
    }

    /**
     * 设置用户侧展示或余额校验使用的积分。
     */
    public function setPoints(int $points): self
    {
        $this->points = $points;
        return $this;
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
     * 设置预估明细。
     *
     * @param array<string, mixed> $detail
     */
    public function setDetail(array $detail): self
    {
        $this->detail = $detail;
        return $this;
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
