<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Entity\ValueObject\Query\MagicUserSettingQuery;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
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

    public function saveProjectTopicModelConfig(Authenticatable $authorization, string $topicId, array $model): MagicUserSettingEntity
    {
        /* @phpstan-ignore-next-line */
        $dataIsolation = $this->createDataIsolation($authorization);
        $entity = new MagicUserSettingEntity();
        $entity->setKey(UserSettingKey::genSuperMagicProjectTopicModel($topicId));
        $entity->setValue([
            'model' => $model,
        ]);
        return $this->magicUserSettingDomainService->save($dataIsolation, $entity);
    }

    public function getProjectTopicModelConfig(Authenticatable $authorization, string $topicId): ?MagicUserSettingEntity
    {
        $key = UserSettingKey::genSuperMagicProjectTopicModel($topicId);
        /* @phpstan-ignore-next-line */
        return $this->get($authorization, $key);
    }

    public function saveProjectMcpServerConfig(Authenticatable $authorization, string $projectId, array $servers): MagicUserSettingEntity
    {
        /* @phpstan-ignore-next-line */
        $dataIsolation = $this->createDataIsolation($authorization);
        $entity = new MagicUserSettingEntity();
        $entity->setKey(UserSettingKey::genSuperMagicProjectMCPServers($projectId));
        $entity->setValue([
            'servers' => $servers,
        ]);
        return $this->magicUserSettingDomainService->save($dataIsolation, $entity);
    }

    public function getProjectMcpServerConfig(Authenticatable $authorization, string $projectId): ?MagicUserSettingEntity
    {
        $key = UserSettingKey::genSuperMagicProjectMCPServers($projectId);
        /* @phpstan-ignore-next-line */
        return $this->get($authorization, $key);
    }

    /**
     * @param MagicUserAuthorization $authorization
     */
    public function save(Authenticatable $authorization, MagicUserSettingEntity $entity): MagicUserSettingEntity
    {
        $dataIsolation = $this->createDataIsolation($authorization);
        $key = UserSettingKey::make($entity->getKey());
        if (! $key->isValid()) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
        }
        return $this->magicUserSettingDomainService->save($dataIsolation, $entity);
    }

    /**
     * @param MagicUserAuthorization $authorization
     */
    public function get(Authenticatable $authorization, string $key): ?MagicUserSettingEntity
    {
        $dataIsolation = $this->createDataIsolation($authorization);
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        $setting = $this->magicUserSettingDomainService->get($dataIsolation, $key);

        $key = UserSettingKey::make($key);
        if ($setting) {
            $key?->getValueHandler()?->populateValue($flowDataIsolation, $setting);
        } else {
            $setting = $key?->getValueHandler()?->generateDefault() ?? null;
        }

        return $setting;
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
