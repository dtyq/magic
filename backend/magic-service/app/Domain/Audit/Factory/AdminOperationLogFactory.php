<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\Factory;

use App\Domain\Audit\Contract\PermissionLabelProviderInterface;
use App\Domain\Audit\Entity\AdminOperationLogEntity;
use App\Domain\Audit\Event\AdminOperationLogEvent;

/**
 * 管理员操作日志工厂类.
 */
class AdminOperationLogFactory
{
    /**
     * 从事件创建操作日志实体.
     */
    public static function createFromEvent(
        AdminOperationLogEvent $event,
        PermissionLabelProviderInterface $labelProvider
    ): AdminOperationLogEntity {
        $entity = new AdminOperationLogEntity();

        $authorization = $event->getAuthorization();
        $requestInfo = $event->getRequestInfo();
        $permissionKey = $event->getMatchedPermissionKey();

        // 用户和组织信息
        $entity->setOrganizationCode($authorization->getOrganizationCode());
        $entity->setUserId($authorization->getId());
        $entity->setUserName($authorization->getDisplayName());

        // 解析权限键，提取 resource_code 和 operation_code
        [$resourceCode, $operationCode] = self::parsePermissionKey($permissionKey);
        $entity->setResourceCode($resourceCode);
        $entity->setOperationCode($operationCode);

        // 获取资源和操作的中文标签
        $entity->setResourceLabel($labelProvider->getResourceLabelPath($resourceCode));
        $entity->setOperationLabel($labelProvider->getOperationLabelByResource($resourceCode, $operationCode));

        // 生成操作描述
        $description = self::generateDescription(
            $labelProvider,
            $resourceCode,
            $operationCode
        );
        $entity->setOperationDescription($description);

        // 获取客户端 IP
        $entity->setIp($requestInfo->getIp());

        // 设置请求 URL 和请求体
        $entity->setRequestUrl($requestInfo->getFullUrl());
        $entity->setRequestBody($requestInfo->getRequestBody());

        return $entity;
    }

    /**
     * 解析权限键.
     * 例如：platform.ai.model_management.query -> [platform.ai.model_management, query].
     */
    private static function parsePermissionKey(string $permissionKey): array
    {
        if (empty($permissionKey)) {
            return ['unknown', 'unknown'];
        }

        $parts = explode('.', $permissionKey);
        if (empty($parts)) {
            return ['unknown', 'unknown'];
        }

        $operationCode = array_pop($parts);
        $resourceCode = implode('.', $parts);

        // 确保两个值都不为空
        if (empty($resourceCode)) {
            $resourceCode = 'unknown';
        }
        if (empty($operationCode)) {
            $operationCode = 'unknown';
        }

        return [$resourceCode, $operationCode];
    }

    /**
     * 生成操作描述.
     */
    private static function generateDescription(
        PermissionLabelProviderInterface $labelProvider,
        string $resourceCode,
        string $operationCode
    ): string {
        // 根据操作类型和资源生成通用描述
        $operationLabel = $labelProvider->getOperationLabelByResource($resourceCode, $operationCode);
        $resourceLabel = $labelProvider->getResourceLabelPath($resourceCode);

        return "{$operationLabel}：{$resourceLabel}";
    }
}
