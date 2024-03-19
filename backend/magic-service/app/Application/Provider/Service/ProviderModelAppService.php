<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\DTO\ProviderModelItemDTO;
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

        $this->processModelIcons($models);

        // 处理图标
        $providerModelDetailDTOs = [];
        foreach ($models as $model) {
            $model->setName($model->getLocalizedName($locale));
            $model->setDescription($model->getLocalizedDescription($locale));

            if (! $model->getName()) {
                $model->setName($model->getModelId());
            }

            $providerModelDetailDTOs[] = new ProviderModelItemDTO($model->toArray());
        }

        return [
            'list' => $providerModelDetailDTOs,
            'total' => count($providerModelDetailDTOs),
        ];
    }
}
