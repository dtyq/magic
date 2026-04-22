<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Service;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\SizeManager;
use App\Interfaces\Design\DTO\ImageConvertHighConfigDTO;
use Hyperf\Di\Annotation\Inject;

/**
 * Image convert high definition config application service.
 */
class ImageConvertHighConfigAppService extends DesignAppService
{
    #[Inject]
    protected AiAbilityDomainService $aiAbilityDomainService;

    #[Inject]
    protected ProviderModelDomainService $providerModelDomainService;

    /**
     * Get image convert high definition config.
     *
     * @return ImageConvertHighConfigDTO Returns config info including whether convert high is supported and supported sizes list
     */
    public function getImageConvertHighConfig(): ImageConvertHighConfigDTO
    {
        $dto = new ImageConvertHighConfigDTO();

        // Get model_id from AI ability config
        $config = $this->aiAbilityDomainService->getProviderConfig(AiAbilityCode::ImageConvertHigh);
        $modelId = $config['model_id'] ?? null;

        // If convert high is not supported (model_id not configured), return not supported
        if (empty($modelId)) {
            return $dto->setSupported(false)->setImageSizeConfig(['sizes' => []]);
        }

        // Get model entity to get model_version
        $dataIsolation = ProviderDataIsolation::create('');
        $modelEntity = $this->providerModelDomainService->getByModelId($dataIsolation, $modelId);

        // If model not found, return not supported
        if ($modelEntity === null) {
            return $dto->setSupported(false)->setImageSizeConfig(['sizes' => []]);
        }

        // Get model size config
        $modelVersion = $modelEntity->getModelVersion();
        $sizes = SizeManager::getMaxScaleSizes($modelVersion, $modelId);

        // If size config not found, return not supported
        if (empty($sizes)) {
            return $dto->setSupported(true)->setImageSizeConfig(['sizes' => []]);
        }

        // Return supported sizes list
        return $dto->setSupported(true)->setImageSizeConfig(['sizes' => $sizes]);
    }
}
