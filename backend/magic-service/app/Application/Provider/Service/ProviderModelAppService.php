<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\DTO\Item\BillingType;
use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\DTO\ProviderModelItemDTO;
use App\Domain\Provider\Entity\ProviderModelConfigVersionEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\DTO\ModelPricingItemDTO;
use Dtyq\BillingManager\Infrastructure\Util\Common\CurrencyToPointsCalculate;
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
     * 根据 model_ids 获取模型价格信息.
     *
     * @param array<string> $modelIds 模型ID数组
     * @return ModelPricingItemDTO[] 模型价格信息数组
     */
    public function getModelPricingByModelIds(array $modelIds): array
    {
        if ($modelIds === []) {
            return [];
        }

        $dataIsolation = ProviderDataIsolation::create(OfficialOrganizationUtil::getOfficialOrganizationCode(), '');
        $modelsByModelId = $this->providerModelDomainService->getModelsByModelIds($dataIsolation, $modelIds);

        $result = [];
        foreach ($modelIds as $modelId) {
            $models = $modelsByModelId[$modelId] ?? [];
            $result[] = $this->buildPricingItemDTO($modelId, $models);
        }

        return $result;
    }

    /**
     * @param ProviderModelEntity[] $models
     */
    private function buildPricingItemDTO(string $modelId, array $models): ModelPricingItemDTO
    {
        $itemDTO = new ModelPricingItemDTO();
        $itemDTO->setModelId($modelId);

        if ($models === []) {
            return $itemDTO;
        }

        $selectedModel = $this->selectHighestPricingModel($models);
        $configVersion = $this->providerModelDomainService->getLatestConfigVersionEntity(
            ProviderDataIsolation::create(OfficialOrganizationUtil::getOfficialOrganizationCode(), ''),
            (int) $selectedModel->getId()
        );

        if ($configVersion instanceof ProviderModelConfigVersionEntity) {
            return $this->buildPricingItemDTOFromConfigVersion($selectedModel, $configVersion, $itemDTO);
        }

        $config = $selectedModel->getConfig();

        if ($config === null) {
            $itemDTO->setModelName($selectedModel->getName());
            return $itemDTO;
        }

        $billingType = $config->getBillingType() ?? BillingType::Tokens;
        $billingCurrency = $config->getBillingCurrency() ?? 'CNY';

        $itemDTO->setModelName($selectedModel->getName());
        $itemDTO->setBillingType($billingType->value);
        $itemDTO->setInputPoints($this->convertPricingToPoints($config->getInputPricing(), $billingCurrency));
        $itemDTO->setOutputPoints($this->convertPricingToPoints($config->getOutputPricing(), $billingCurrency));
        $itemDTO->setTimePoints($this->convertPricingToPoints($config->getTimePricing(), $billingCurrency));

        return $itemDTO;
    }

    /**
     * @param ProviderModelEntity[] $models
     */
    private function selectHighestPricingModel(array $models): ProviderModelEntity
    {
        if (count($models) === 1) {
            return $models[0];
        }

        $highestModel = null;
        $highestPriceInPoints = -1.0;

        foreach ($models as $model) {
            $priceInPoints = $this->calculateModelPriceInPoints($model);
            if ($priceInPoints > $highestPriceInPoints) {
                $highestPriceInPoints = $priceInPoints;
                $highestModel = $model;
            }
        }

        return $highestModel ?? $models[0];
    }

    private function buildPricingItemDTOFromConfigVersion(
        ProviderModelEntity $selectedModel,
        ProviderModelConfigVersionEntity $configVersion,
        ModelPricingItemDTO $itemDTO
    ): ModelPricingItemDTO {
        $billingType = $configVersion->getBillingType() ?? BillingType::Tokens->value;
        $billingCurrency = $configVersion->getBillingCurrency() ?? 'CNY';

        $itemDTO->setModelName($selectedModel->getName());
        $itemDTO->setBillingType($billingType);
        $itemDTO->setInputPoints($this->convertPricingToPoints($this->formatFloatPricing($configVersion->getInputPricing()), $billingCurrency));
        $itemDTO->setOutputPoints($this->convertPricingToPoints($this->formatFloatPricing($configVersion->getOutputPricing()), $billingCurrency));
        $itemDTO->setTimePoints($this->convertPricingToPoints($this->formatFloatPricing($configVersion->getTimePricing()), $billingCurrency));

        return $itemDTO;
    }

    private function calculateModelPriceInPoints(ProviderModelEntity $model): float
    {
        $config = $model->getConfig();
        if ($config === null) {
            return 0;
        }

        $billingType = $config->getBillingType();
        $billingCurrency = $config->getBillingCurrency() ?? 'CNY';
        $priceInYuan = $this->calculatePriceInYuan($config, $billingType);

        if ($priceInYuan <= 0) {
            return 0;
        }

        return (float) CurrencyToPointsCalculate::convertToPoints((string) $priceInYuan, $billingCurrency);
    }

    private function calculatePriceInYuan(ModelConfigItem $config, BillingType $billingType): float
    {
        if ($billingType->isTokens()) {
            $inputPrice = $config->getInputPricing() !== null ? (float) $config->getInputPricing() : 0;
            $outputPrice = $config->getOutputPricing() !== null ? (float) $config->getOutputPricing() : 0;
            return $inputPrice + $outputPrice;
        }

        if ($billingType->isTimes()) {
            return $config->getTimePricing() !== null ? (float) $config->getTimePricing() : 0;
        }

        return 0;
    }

    private function convertPricingToPoints(?string $pricing, string $currency): ?int
    {
        if ($pricing === null) {
            return null;
        }

        $priceFloat = (float) $pricing;
        if ($priceFloat <= 0) {
            return 0;
        }

        $points = CurrencyToPointsCalculate::convertToPoints($pricing, $currency);
        return (int) ceil((float) $points);
    }

    private function formatFloatPricing(?float $pricing): ?string
    {
        if ($pricing === null) {
            return null;
        }

        return rtrim(rtrim(number_format($pricing, 4, '.', ''), '0'), '.') ?: '0';
    }
}
