<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

use App\Domain\Contact\Entity\MagicUserEntity;
use Dtyq\SuperMagic\Domain\RecycleBin\Entity\RecycleBinEntity;

/**
 * 回收站列表项 DTO.
 * ID 类字段使用 string 返回给前端，避免 JS Number 精度问题(见 Cursor 规则).
 */
class RecycleBinItemDTO
{
    public string $id = '';

    public int $resourceType;

    public string $resourceTypeName = '';

    public string $resourceId = '';

    public string $resourceName = '';

    public string $ownerId = '';

    public string $deletedBy = '';

    public string $deletedAt = '';

    public string $expireAt = '';

    public ?string $parentId = null;

    public ?array $extraData = null;

    public int $remainingDays = 0;

    public ?DeletedByUserDTO $deletedByUser = null;

    /**
     * 从实体创建 DTO.
     */
    public static function fromEntity(RecycleBinEntity $entity, ?MagicUserEntity $deletedByUser = null): self
    {
        $dto = new self();
        $dto->id = (string) $entity->getId();
        $dto->resourceType = $entity->getResourceType()->value;
        $dto->resourceTypeName = $entity->getResourceType()->getName();
        $dto->resourceId = (string) $entity->getResourceId();
        $dto->resourceName = $entity->getResourceName();
        $dto->ownerId = $entity->getOwnerId();
        $dto->deletedBy = $entity->getDeletedBy();
        $dto->deletedByUser = DeletedByUserDTO::fromEntity($deletedByUser);
        $dto->deletedAt = $entity->getDeletedAt();

        $retainDays = $entity->getRetainDays();
        $deletedAt = strtotime($entity->getDeletedAt());
        $dto->expireAt = date('Y-m-d H:i:s', $deletedAt + ($retainDays * 86400));

        $expireTimestamp = $deletedAt + ($retainDays * 86400);
        $remainingSeconds = $expireTimestamp - time();
        $dto->remainingDays = $remainingSeconds > 0 ? (int) ceil($remainingSeconds / 86400) : 0;

        $dto->parentId = $entity->getParentId() !== null ? (string) $entity->getParentId() : null;
        $dto->extraData = $entity->getExtraData();

        return $dto;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'resource_type' => $this->resourceType,
            'resource_type_name' => $this->resourceTypeName,
            'resource_id' => $this->resourceId,
            'resource_name' => $this->resourceName,
            'owner_id' => $this->ownerId,
            'deleted_by' => $this->deletedBy,
            'deleted_at' => $this->deletedAt,
            'expire_at' => $this->expireAt,
            'parent_id' => $this->parentId,
            'extra_data' => $this->extraData,
            'remaining_days' => $this->remainingDays,
            'deleted_by_user' => $this->deletedByUser?->toArray(),
        ];
    }
}
