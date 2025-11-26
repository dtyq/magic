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
        $value = $setting->getValue();
        $providerDataIsolation = ProviderDataIsolation::createByBaseDataIsolation($dataIsolation);
        $result = ['model' => new stdClass(), 'image_model' => new stdClass()];

        // Process model
        $modelId = $value['model']['model_id'] ?? null;
        if (! empty($modelId)) {
            $providerModel = $this->providerModelDomainService->getByIdOrModelId($providerDataIsolation, $modelId);
            if ($providerModel) {
                $result['model'] = [
                    'model_id' => $modelId,
                    'id' => (string) $providerModel->getId(),
                    'name' => $providerModel->getName(),
                    'icon' => $this->fileDomainService->getLink($providerDataIsolation->getCurrentOrganizationCode(), $providerModel->getIcon())?->getUrl() ?? '',
                ];
            }
        }

        // Process image_model
        $imageModelId = $value['image_model']['model_id'] ?? null;
        if (! empty($imageModelId)) {
            $imageProviderModel = $this->providerModelDomainService->getByIdOrModelId($providerDataIsolation, $imageModelId);
            if ($imageProviderModel) {
                $result['image_model'] = [
                    'model_id' => $imageModelId,
                    'id' => (string) $imageProviderModel->getId(),
                    'name' => $imageProviderModel->getName(),
                    'icon' => $this->fileDomainService->getLink($providerDataIsolation->getCurrentOrganizationCode(), $imageProviderModel->getIcon())?->getUrl() ?? '',
                ];
            }
        }

        $setting->setValue($result);
    }

    public function generateDefault(): ?MagicUserSettingEntity
    {
        $setting = new MagicUserSettingEntity();
        $setting->setKey(UserSettingKey::SuperMagicMCPServers->value);
        $setting->setValue(['model' => new stdClass(), 'image_model' => new stdClass()]);
        $setting->setCreatedAt(new DateTime());
        $setting->setUpdatedAt(new DateTime());
        return $setting;
    }
}
