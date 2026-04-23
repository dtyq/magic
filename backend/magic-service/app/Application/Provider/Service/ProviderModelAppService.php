<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Application\Kernel\EnvManager;
use App\Application\Permission\Service\UserModelAccessAppService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Provider\DTO\ProviderModelItemDTO;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Contract\TranslatorInterface;

class ProviderModelAppService extends AbstractProviderAppService
{
    public function __construct(
        private readonly ProviderModelDomainService $providerModelDomainService,
        FileDomainService $fileDomainService,
    ) {
        parent::__construct($fileDomainService);
    }

    /**
     * 获取当前组织下的所有模型列表（不校验管理员权限）.
     * @param MagicUserAuthorization $authorization 授权信息
     * @return array 返回包含list和total的数组
     */
    public function getCurrentOrganizationModels(MagicUserAuthorization $authorization): array
    {
        $organizationCode = $authorization->getOrganizationCode();
        $userId = $authorization->getId();

        if (OfficialOrganizationUtil::isOfficialOrganization($organizationCode)) {
            return [
                'list' => [],
                'total' => 0,
            ];
        }

        $locale = di(TranslatorInterface::class)->getLocale();

        $dataIsolation = ProviderDataIsolation::create($organizationCode, $userId);
        $models = $this->providerModelDomainService->getModelsForOrganization($dataIsolation, isOffModelLoaded: false);
        $models = $this->filterProviderModelsByUserAccess($authorization, $models);

        $this->processModelIcons($models);

        // 处理图标
        $providerModelDetailDTOs = [];
        foreach ($models as $model) {
            $model->setName($model->getLocalizedName($locale));
            $model->setDescription($model->getLocalizedDescription($locale));

            if (! $model->getName()) {
                $model->setName($model->getModelId());
            }

            $providerModelItemDTO = new ProviderModelItemDTO($model->toArray());
            $providerModelItemDTO->setImageSizeConfig($this->getImageSizeConfig($model));
            $providerModelDetailDTOs[] = $providerModelItemDTO;
        }

        return [
            'list' => $providerModelDetailDTOs,
            'total' => count($providerModelDetailDTOs),
        ];
    }

    /**
     * 获取当前组织下前台可见的活跃模型列表.
     *
     * @param ModelType[] $modelTypes
     * @return ProviderModelItemDTO[]
     */
    public function getAvailableOrganizationModels(
        MagicUserAuthorization $authorization,
        ?Category $category = null,
        array $modelTypes = []
    ): array {
        $modelGatewayDataIsolation = new ModelGatewayDataIsolation(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
            $authorization->getMagicId()
        );
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        $models = $this->providerModelDomainService->getEnableModels($dataIsolation, $category, $modelTypes);
        if ($models === []) {
            return [];
        }

        EnvManager::initDataIsolationEnv($modelGatewayDataIsolation, force: true);
        $availableModelIds = $modelGatewayDataIsolation->getSubscriptionManager()->getAvailableModelIds(null);
        $accessibleModelIdMap = $this->getAccessibleModelIdMap($authorization);

        $providerModelItemDTOs = [];
        foreach ($models as $model) {
            $modelId = $model->getModelId();
            if ($availableModelIds !== null && ! in_array($modelId, $availableModelIds, true)) {
                continue;
            }
            if ($accessibleModelIdMap !== null && ! isset($accessibleModelIdMap[$modelId])) {
                continue;
            }
            if (isset($providerModelItemDTOs[$modelId])) {
                continue;
            }

            $providerModelItemDTOs[$modelId] = new ProviderModelItemDTO([
                'id' => (string) $model->getId(),
                'name' => $model->getName(),
                'model_id' => $modelId,
                'model_type' => $model->getModelType()->value,
                'category' => $model->getCategory()->value,
                'icon' => $model->getIcon(),
                'description' => $model->getDescription(),
            ]);
        }

        $sortedModels = array_values($providerModelItemDTOs);
        usort($sortedModels, static function ($a, $b) {
            return strcmp($a->getName(), $b->getName());
        });
        $this->processModelIcons($sortedModels);

        return $sortedModels;
    }

    /**
     * @param ProviderModelEntity[] $models
     * @return ProviderModelEntity[]
     */
    private function filterProviderModelsByUserAccess(MagicUserAuthorization $authorization, array $models): array
    {
        return $this->getUserModelAccessAppService()->filterModelEntries(
            $authorization,
            $models,
            static fn (ProviderModelEntity $model): string => $model->getModelId()
        );
    }

    /**
     * @return null|array<string, true>
     */
    private function getAccessibleModelIdMap(MagicUserAuthorization $authorization): ?array
    {
        $context = $this->getUserModelAccessAppService()->resolveAccessContext($authorization);
        return $context['is_restricted'] ? $context['accessible_model_id_map'] : null;
    }

    private function getUserModelAccessAppService(): UserModelAccessAppService
    {
        return di(UserModelAccessAppService::class);
    }
}
