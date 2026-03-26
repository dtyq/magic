<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Factory;

use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;
use App\Domain\Audit\ModelCall\Entity\ValueObject\ModelAuditAccessScope;
use DateTime;

class AuditLogFactory
{
    /**
     * @param array<string, mixed> $usage
     */
    public static function createNew(
        string $userId,
        string $organizationCode,
        string $ip,
        string $type,
        string $productCode,
        string $status,
        string $ak,
        int $operationTime,
        int $allLatency,
        array $usage = [],
        ?array $detailInfo = null,
        ModelAuditAccessScope $accessScope = ModelAuditAccessScope::Magic,
        ?string $magicTopicId = null,
        ?string $requestId = null,
    ): AuditLogEntity {
        $now = new DateTime();

        $entity = new AuditLogEntity();
        $entity->setUserId($userId);
        $entity->setOrganizationCode($organizationCode);
        $entity->setIp($ip);
        $entity->setType($type);
        $entity->setProductCode($productCode);
        $entity->setStatus($status);
        $entity->setAk($ak);
        $entity->setOperationTime($operationTime);
        $entity->setAllLatency($allLatency);
        $entity->setUsage($usage);
        $entity->setDetailInfo($detailInfo);
        $entity->setAccessScope($accessScope);
        $entity->setMagicTopicId($magicTopicId);
        $entity->setRequestId($requestId);
        $entity->setCreatedAt($now);
        $entity->setUpdatedAt($now);

        return $entity;
    }
}
