<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Entity\ValueObject\Query\MagicUserSettingQuery;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\DataIsolationTrait;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;

class MagicUserSettingAppService extends AbstractContactAppService
{
    use DataIsolationTrait;

    #[Inject]
    protected MagicUserRepositoryInterface $magicUserRepository;

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

    /**
     * 保存当前组织信息（通过 magicId）.
     * @param string $magicId 账号标识
     * @param array<string, mixed> $organizationData 组织信息数据
     */
    public function saveCurrentOrganizationDataByMagicId(string $magicId, array $organizationData): MagicUserSettingEntity
    {
        $entity = new MagicUserSettingEntity();
        $entity->setKey(UserSettingKey::CurrentOrganization->value);
        $entity->setValue($organizationData);

        return $this->magicUserSettingDomainService->saveByMagicId($magicId, $entity);
    }

    /**
     * 获取当前组织信息（通过 magicId）.
     * @param string $magicId 账号标识
     * @return null|array<string, mixed>
     */
    public function getCurrentOrganizationDataByMagicId(string $magicId): ?array
    {
        $setting = $this->magicUserSettingDomainService->getByMagicId($magicId, UserSettingKey::CurrentOrganization->value);
        return $setting?->getValue();
    }
}
