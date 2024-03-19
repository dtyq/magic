<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Audit\Assembler;

use App\Domain\Audit\Entity\AdminOperationLogEntity;
use App\Interfaces\Audit\DTO\AdminOperationLogDTO;

/**
 * 操作日志数据组装器.
 */
class AdminOperationLogAssembler
{
    /**
     * Entity 转 DTO.
     */
    public static function toDTO(AdminOperationLogEntity $entity): AdminOperationLogDTO
    {
        $dto = new AdminOperationLogDTO();

        // ID必须转为字符串（避免JavaScript精度丢失）
        $dto->id = (string) $entity->getId();
        $dto->userName = $entity->getUserName() ?? '';
        $dto->userId = $entity->getUserId() ?? '';
        $dto->ip = $entity->getIp() ?? '';
        $dto->requestUrl = $entity->getRequestUrl() ?? '';
        $dto->requestBody = $entity->getRequestBody() ?? '';

        // 时间格式化
        $createdAt = $entity->getCreatedAt();
        $dto->operationTime = $createdAt ? $createdAt->format('Y-m-d H:i:s') : '';

        // 资源和操作信息
        $dto->resourceCode = $entity->getResourceCode() ?? '';
        $dto->resourceLabel = $entity->getResourceLabel() ?? '';
        $dto->operationCode = $entity->getOperationCode() ?? '';
        $dto->operationLabel = $entity->getOperationLabel() ?? '';
        $dto->operationDescription = $entity->getOperationDescription() ?? '';

        return $dto;
    }

    /**
     * Entity 列表转 DTO 数组.
     * @param AdminOperationLogEntity[] $entities
     * @return AdminOperationLogDTO[]
     */
    public static function toDTOList(array $entities): array
    {
        $dtos = [];
        foreach ($entities as $entity) {
            $dtos[] = self::toDTO($entity);
        }
        return $dtos;
    }
}
