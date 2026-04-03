<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\WebScrape;

use Hyperf\Context\ApplicationContext;
use InvalidArgumentException;

/**
 * 网页爬取工厂类.
 */
class WebScrapeFactory
{
    /**
     * 根据配置创建爬取实例.
     *
     * @param array $config AI能力配置数组
     * @throws InvalidArgumentException 当配置无效或不支持的平台时抛出
     */
    public static function create(array $config): WebScrapeInterface
    {
        // 从 providers 数组中获取启用的平台
        $providers = $config['providers'] ?? [];
        if (empty($providers)) {
            throw new InvalidArgumentException('No providers configured');
        }

        $enabledProvider = self::getEnabledProvider($providers);
        if (! $enabledProvider) {
            throw new InvalidArgumentException('No enabled provider found in configuration');
        }

        $providerName = $enabledProvider['provider'] ?? '';
        if (empty($providerName)) {
            throw new InvalidArgumentException('Provider is required');
        }

        // 获取提供商枚举
        $provider = WebScrapeProvider::fromString($providerName);
        if ($provider === null) {
            throw new InvalidArgumentException("Unsupported platform: {$providerName}");
        }

        // 根据平台类型创建实例
        return self::createInstance($provider, $enabledProvider);
    }

    /**
     * 根据单个 provider 配置创建爬取实例.
     *
     * @throws InvalidArgumentException 当配置无效或不支持的平台时抛出
     */
    public static function createByProviderConfig(array $providerConfig): WebScrapeInterface
    {
        $providerName = $providerConfig['provider'] ?? '';
        if (empty($providerName)) {
            throw new InvalidArgumentException('Provider is required');
        }

        $provider = WebScrapeProvider::fromString((string) $providerName);
        if ($provider === null) {
            throw new InvalidArgumentException("Unsupported platform: {$providerName}");
        }

        if (! self::validateProviderConfig($provider, $providerConfig)) {
            throw new InvalidArgumentException("Invalid provider configuration: {$providerName}");
        }

        return self::createInstance($provider, $providerConfig);
    }

    /**
     * 验证配置格式.
     *
     * @param array $config 配置数组
     */
    public static function validateConfig(array $config): bool
    {
        // 检查必需字段
        if (! isset($config['providers']) || ! is_array($config['providers'])) {
            return false;
        }

        $providers = $config['providers'];
        if (empty($providers)) {
            return false;
        }

        // 检查是否至少有一个启用的平台
        $enabledProvider = self::getEnabledProvider($providers);
        if (! $enabledProvider) {
            return false;
        }

        // 验证平台名称
        $providerName = $enabledProvider['provider'] ?? '';
        if (empty($providerName)) {
            return false;
        }

        // 获取提供商枚举
        $provider = WebScrapeProvider::fromString($providerName);
        if ($provider === null) {
            return false;
        }

        // 验证配置
        return self::validateProviderConfig($provider, $enabledProvider);
    }

    /**
     * 获取支持的平台列表.
     */
    public static function getSupportedPlatforms(): array
    {
        return WebScrapeProvider::getAllProviders();
    }

    /**
     * 获取启用的平台配置.
     *
     * @param array $providers 平台配置数组
     * @return null|array 返回第一个启用的平台配置，如果没有则返回null
     */
    private static function getEnabledProvider(array $providers): ?array
    {
        foreach ($providers as $provider) {
            if (($provider['enable'] ?? false) === true) {
                return $provider;
            }
        }
        return null;
    }

    /**
     * 创建提供商实例.
     */
    private static function createInstance(WebScrapeProvider $provider, array $config): WebScrapeInterface
    {
        $container = ApplicationContext::getContainer();
        $className = $provider->getImplementationClass();
        $instance = $container->get($className);
        $instance->configure($config);

        return $instance;
    }

    /**
     * 验证提供商配置.
     */
    private static function validateProviderConfig(WebScrapeProvider $provider, array $config): bool
    {
        $requiredFields = $provider->getRequiredFields();

        foreach ($requiredFields as $field) {
            if (! isset($config[$field])) {
                return false;
            }
        }

        // 验证特定的必需字段不能为空
        $fieldsToCheck = match ($provider) {
            WebScrapeProvider::Cloudsway, WebScrapeProvider::Magic => ['name', 'request_url', 'api_key'],
        };

        foreach ($fieldsToCheck as $field) {
            if (empty($config[$field])) {
                return false;
            }
        }

        return true;
    }
}
