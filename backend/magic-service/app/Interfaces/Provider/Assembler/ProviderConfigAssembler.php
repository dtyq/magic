<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Assembler;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Domain\Provider\DTO\ProviderConfigDTO;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Infrastructure\Util\Aes\AesUtil;
use Hyperf\Codec\Json;
use Hyperf\Contract\TranslatorInterface;

use function Hyperf\Config\config;

class ProviderConfigAssembler
{
    public static function modelToEntity(ProviderConfigModel $model): ProviderConfigEntity
    {
        return new ProviderConfigEntity($model->toArray());
    }

    public static function toEntity(array $serviceProviderConfig): ProviderConfigEntity
    {
        [$preparedConfig, $decodeConfig] = self::prepareServiceProviderConfig($serviceProviderConfig);
        $preparedConfig['config'] = new ProviderConfigItem($decodeConfig);
        $translator = di(TranslatorInterface::class);
        $serviceProviderConfigEntity = new ProviderConfigEntity($preparedConfig);
        $serviceProviderConfigEntity->i18n($translator->getLocale());
        return $serviceProviderConfigEntity;
    }

    public static function toEntities(array $serviceProviderConfigs): array
    {
        if (empty($serviceProviderConfigs)) {
            return [];
        }
        $configEntities = [];
        foreach ($serviceProviderConfigs as $serviceProviderConfig) {
            $configEntities[] = self::toEntity((array) $serviceProviderConfig);
        }
        return $configEntities;
    }

    /**
     * 将服务商配置数组转换为 DTO 列表，包含完整的 provider 信息.
     * @param array $serviceProviderConfigs 服务商配置数组
     * @param array $providerMap provider ID 到 provider 数据的映射
     * @return ProviderConfigDTO[]
     */
    public static function toDTOListWithProviders(array $serviceProviderConfigs, array $providerMap): array
    {
        if (empty($serviceProviderConfigs)) {
            return [];
        }
        $configDTOs = [];
        foreach ($serviceProviderConfigs as $serviceProviderConfig) {
            $configDTOs[] = self::toDTOWithProvider((array) $serviceProviderConfig, $providerMap);
        }
        return $configDTOs;
    }

    /**
     * 将服务商配置转换为 DTO，包含完整的 provider 信息.
     * @param array $serviceProviderConfig 服务商配置数据
     * @param array $providerMap provider ID 到 provider 数据的映射
     */
    public static function toDTOWithProvider(array $serviceProviderConfig, array $providerMap): ProviderConfigDTO
    {
        [$preparedConfig, $decodeConfig] = self::prepareServiceProviderConfig($serviceProviderConfig);
        $preparedConfig['config'] = $decodeConfig;
        // 无特殊声明不处理
        $preparedConfig['decryptedConfig'] = null;

        $translator = di(TranslatorInterface::class);
        $locale = $translator->getLocale();

        // 从 providerMap 中获取对应的 provider 信息
        $providerId = $serviceProviderConfig['service_provider_id'];
        if (isset($providerMap[$providerId])) {
            $provider = $providerMap[$providerId];

            $translate = Json::decode($provider['translate']);
            // 合并 provider 信息到配置中
            $preparedConfig['name'] = $translate['name'][$locale] ?? '';
            $preparedConfig['description'] = $translate['description'][$locale] ?? '';
            $preparedConfig['icon'] = $provider['icon'] ?? '';
            $preparedConfig['provider_type'] = $provider['provider_type'] ?? null;
            $preparedConfig['category'] = $provider['category'] ?? null;
            $preparedConfig['provider_code'] = $provider['provider_code'] ?? null;
            $preparedConfig['is_models_enable'] = $provider['is_models_enable'] ?? true;

            // 直接使用 provider 的翻译信息（config 中只有 ak、sk 等配置，没有翻译数据）
            if (! empty($provider['translate'])) {
                $providerTranslate = is_string($provider['translate'])
                    ? Json::decode($provider['translate'])
                    : $provider['translate'];
                $preparedConfig['translate'] = $providerTranslate;
            }
        }

        return new ProviderConfigDTO($preparedConfig);
    }

    /**
     * @param $configEntities ProviderConfigEntity[]
     */
    public static function toArrays(array $configEntities): array
    {
        if (empty($configEntities)) {
            return [];
        }
        $result = [];
        foreach ($configEntities as $entity) {
            $result[] = $entity->toArray();
        }
        return $result;
    }

    public static function decodeConfig(string $config, string $salt): array
    {
        $decode = AesUtil::decode(self::_getAesKey($salt), $config);
        if (! $decode) {
            return [];
        }
        return Json::decode($decode);
    }

    /**
     * 对配置数据进行编码（JSON编码 + AES加密）.
     */
    public static function encodeConfig(array $config, string $salt): string
    {
        $jsonEncoded = Json::encode($config);
        return AesUtil::encode(self::_getAesKey($salt), $jsonEncoded);
    }

    /**
     * 预处理服务商配置数据，提取共同逻辑.
     * @return array [$preparedConfig, $decodeConfig]
     */
    private static function prepareServiceProviderConfig(array $serviceProviderConfig): array
    {
        $decodeConfig = $serviceProviderConfig['config'];
        if (is_string($serviceProviderConfig['config'])) {
            $decodeConfig = self::decodeConfig($serviceProviderConfig['config'], (string) $serviceProviderConfig['id']);
        }

        // 设置默认的translate
        if (empty($serviceProviderConfig['translate'])) {
            $serviceProviderConfig['translate'] = [];
        }

        return [$serviceProviderConfig, $decodeConfig];
    }

    private static function _getAesKey(string $salt): string
    {
        return config('service_provider.model_aes_key') . $salt;
    }
}
