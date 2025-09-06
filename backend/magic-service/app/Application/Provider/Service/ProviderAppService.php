<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace app\Application\Provider\Service;

use App\Application\Provider\DTO\SuperMagicModelDTO;
use App\Application\Provider\DTO\SuperMagicProviderDTO;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use Hyperf\Contract\TranslatorInterface;

class ProviderAppService
{
    public function __construct(
        protected AdminProviderDomainService $adminProviderDomainService,
        protected ProviderConfigDomainService $providerConfigDomainService,
        protected FileDomainService $fileDomainService,
        protected TranslatorInterface $translator
    ) {
    }

    /**
     * Get super magic display models and Magic provider models visible to current organization.
     * @param string $organizationCode Organization code
     * @return SuperMagicModelDTO[]
     */
    public function getSuperMagicDisplayModelsForOrganization(string $organizationCode): array
    {
        $models = $this->adminProviderDomainService->getSuperMagicDisplayModelsForOrganization($organizationCode);

        if (empty($models)) {
            return [];
        }

        // 构建数据隔离对象
        $dataIsolation = ProviderDataIsolation::create($organizationCode);

        // 收集所有唯一的服务商配置ID
        $configIds = array_unique(array_map(fn ($model) => $model->getServiceProviderConfigId(), $models));

        // 批量获取服务商实体（避免嵌套查询）
        $providerEntities = $this->providerConfigDomainService->getProviderEntitiesByConfigIds($dataIsolation, $configIds);

        // 批量获取服务商配置实体（用于获取别名）
        $configEntities = $this->providerConfigDomainService->getConfigByIdsWithoutOrganizationFilter($configIds);

        // 收集所有图标路径按组织编码分组（包括模型图标和服务商图标）
        $iconsByOrg = [];
        $iconToModelMap = [];
        $iconToProviderMap = [];

        foreach ($models as $model) {
            // 处理模型图标
            $modelIcon = $model->getIcon();
            if (empty($modelIcon)) {
                continue;
            }
            $iconOrganizationCode = substr($modelIcon, 0, strpos($modelIcon, '/'));
            if (! isset($iconsByOrg[$iconOrganizationCode])) {
                $iconsByOrg[$iconOrganizationCode] = [];
            }
            $iconsByOrg[$iconOrganizationCode][] = $modelIcon;
            if (! isset($iconToModelMap[$modelIcon])) {
                $iconToModelMap[$modelIcon] = [];
            }
            $iconToModelMap[$modelIcon][] = $model;

            // 处理服务商图标
            $configId = $model->getServiceProviderConfigId();
            if (! isset($providerEntities[$configId])) {
                continue;
            }
            $providerIcon = $providerEntities[$configId]->getIcon();
            if (empty($providerIcon)) {
                continue;
            }
            $iconOrganizationCode = substr($providerIcon, 0, strpos($providerIcon, '/'));
            if (! isset($iconsByOrg[$iconOrganizationCode])) {
                $iconsByOrg[$iconOrganizationCode] = [];
            }
            $iconsByOrg[$iconOrganizationCode][] = $providerIcon;
            if (! isset($iconToProviderMap[$providerIcon])) {
                $iconToProviderMap[$providerIcon] = [];
            }
            $iconToProviderMap[$providerIcon][] = $configId;
        }

        // 批量获取图标URL
        $iconUrlMap = [];
        foreach ($iconsByOrg as $iconOrganizationCode => $icons) {
            $links = $this->fileDomainService->getLinks($iconOrganizationCode, array_unique($icons));
            $iconUrlMap[] = $links;
        }
        ! empty($iconUrlMap) && $iconUrlMap = array_merge(...$iconUrlMap);

        // 更新服务商图标URL映射
        $providerIconUrls = [];
        foreach ($iconToProviderMap as $icon => $configIds) {
            if (! isset($iconUrlMap[$icon])) {
                continue;
            }
            $fileLink = $iconUrlMap[$icon];
            if ($fileLink) {
                foreach ($configIds as $configId) {
                    $providerIconUrls[$configId] = $fileLink->getUrl();
                }
            }
        }
        $locale = $this->translator->getLocale();
        // 创建DTO并设置图标URL
        $modelDTOs = [];
        foreach ($models as $model) {
            $modelDTO = new SuperMagicModelDTO($model->toArray());

            $localizedModelName = $model->getLocalizedName($locale);
            $localizedModelDescription = $model->getLocalizedDescription($locale);

            // 如果有国际化名称则使用，否则保持原名称
            if (! empty($localizedModelName)) {
                $modelDTO->setName($localizedModelName);
            }
            $modelDTO->setDescription($localizedModelDescription);

            // 设置模型图标URL
            $modelIcon = $model->getIcon();
            if (! empty($modelIcon) && isset($iconUrlMap[$modelIcon])) {
                $fileLink = $iconUrlMap[$modelIcon];
                if ($fileLink) {
                    $modelDTO->setIcon($fileLink->getUrl());
                }
            }

            // 创建服务商DTO
            $configId = $model->getServiceProviderConfigId();
            $providerEntity = $providerEntities[$configId] ?? null;
            if ($providerEntity) {
                $isRecommended = $model->getConfig()?->isOfficialRecommended() ?? false;
                $configEntity = $configEntities[$configId] ?? null;
                $localizedName = $this->getProviderDisplayName($providerEntity, $configEntity, $isRecommended, $locale);
                $providerIconUrl = $providerIconUrls[$configId] ?? '';

                $providerDTO = new SuperMagicProviderDTO([
                    'name' => $localizedName,
                    'icon' => $providerIconUrl,
                    'sort' => $model->getSort(),
                    'recommended' => $isRecommended,
                ]);
                $modelDTO->setProvider($providerDTO);
            }

            $modelDTOs[] = $modelDTO;
        }

        return $modelDTOs;
    }

    /**
     * 获取服务商显示名称.
     */
    private function getProviderDisplayName(
        ProviderEntity $providerEntity,
        ?ProviderConfigEntity $configEntity,
        bool $isRecommended,
        string $locale
    ): string {
        // 1. 推荐服务商优先
        if ($isRecommended) {
            return $this->translator->trans('common.recommended');
        }

        // 2. 自定义服务商且有别名
        if ($this->isCustomProvider($providerEntity)
            && $configEntity
            && ! empty($configEntity->getAlias())) {
            return $configEntity->getAlias();
        }

        // 3. 默认使用国际化名称
        return $providerEntity->getLocalizedName($locale);
    }

    /**
     * 判断是否为自定义服务商.
     */
    private function isCustomProvider(ProviderEntity $providerEntity): bool
    {
        return $providerEntity->getProviderCode() !== ProviderCode::Official;
    }
}
