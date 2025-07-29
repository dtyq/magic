<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\UserSetting;

use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use DateTime;
use stdClass;

class SuperMagicModelConfigHandler extends AbstractUserSettingHandler
{
    public function __construct(
        protected ProviderModelDomainService $providerModelDomainService,
        protected FileDomainService $fileDomainService,
    ) {
    }

    public function populateValue(BaseDataIsolation $dataIsolation, MagicUserSettingEntity $setting): void
    {
        // 默认值
        $value = ['model' => new stdClass()];

        // 获取模型配置
        $modelId = $setting->getValue()['model']['model_id'] ?? null;
        if (empty($modelId)) {
            $setting->setValue($value);
            return;
        }

        $providerDataIsolation = ProviderDataIsolation::createByBaseDataIsolation($dataIsolation);
        $providerModel = $this->providerModelDomainService->getByIdOrModelId($providerDataIsolation, $modelId);
        if (! $providerModel) {
            $setting->setValue($value);
            return;
        }

        $setting->setValue([
            'model' => [
                'model_id' => $modelId,
                'id' => (string) $providerModel->getId(),
                'name' => $providerModel->getName(),
                'icon' => $this->fileDomainService->getLink($providerDataIsolation->getCurrentOrganizationCode(), $providerModel->getIcon())?->getUrl() ?? '',
            ],
        ]);
    }

    public function generateDefault(): ?MagicUserSettingEntity
    {
        $setting = new MagicUserSettingEntity();
        $setting->setKey(UserSettingKey::SuperMagicMCPServers->value);
        $setting->setValue(['model' => new stdClass()]);
        $setting->setCreatedAt(new DateTime());
        $setting->setUpdatedAt(new DateTime());
        return $setting;
    }
}
