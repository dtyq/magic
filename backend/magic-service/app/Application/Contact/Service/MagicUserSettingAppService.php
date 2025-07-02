<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\Service;

use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Entity\ValueObject\Query\MagicUserSettingQuery;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Infrastructure\Core\Traits\DataIsolationTrait;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Qbhy\HyperfAuth\Authenticatable;

class MagicUserSettingAppService extends AbstractContactAppService
{
    use DataIsolationTrait;

    public function __construct(
        private readonly MagicUserSettingDomainService $magicUserSettingDomainService
    ) {
    }

    /**
     * @param MagicUserAuthorization $authorization
     */
    public function save(Authenticatable $authorization, MagicUserSettingEntity $entity): MagicUserSettingEntity
    {
        $dataIsolation = $this->createDataIsolation($authorization);
        return $this->magicUserSettingDomainService->save($dataIsolation, $entity);
    }

    /**
     * @param MagicUserAuthorization $authorization
     */
    public function get(Authenticatable $authorization, string $key): ?MagicUserSettingEntity
    {
        $dataIsolation = $this->createDataIsolation($authorization);

        return $this->magicUserSettingDomainService->get($dataIsolation, $key);
    }

    /**
     * @param MagicUserAuthorization $authorization
     * @return array{total: int, list: array<MagicUserSettingEntity>}
     */
    public function queries(Authenticatable $authorization, MagicUserSettingQuery $query, Page $page): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);

        // Force query to only return current user's settings
        $query->setUserId($dataIsolation->getCurrentUserId());

        return $this->magicUserSettingDomainService->queries($dataIsolation, $query, $page);
    }
}
