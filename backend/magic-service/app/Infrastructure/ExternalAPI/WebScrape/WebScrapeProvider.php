<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\WebScrape;

/**
 * 网页爬取提供商枚举.
 */
enum WebScrapeProvider: string
{
    case Cloudsway = 'cloudsway';
    case Magic = 'magic';

    /**
     * 获取提供商名称.
     */
    public function getName(): string
    {
        return match ($this) {
            self::Cloudsway => 'Cloudsway',
            self::Magic => 'Magic',
        };
    }

    /**
     * 获取提供商描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::Cloudsway => 'Cloudsway网页爬取服务',
            self::Magic => 'Magic网页爬取服务（私有化环境）',
        };
    }

    /**
     * 获取必需配置字段.
     *
     * @return array<string>
     */
    public function getRequiredFields(): array
    {
        return match ($this) {
            self::Cloudsway => ['name', 'enable', 'base_url', 'api_key'],
            self::Magic => ['name', 'enable', 'request_url', 'api_key'],
        };
    }

    /**
     * 获取可选配置字段.
     *
     * @return array<string>
     */
    public function getOptionalFields(): array
    {
        return match ($this) {
            self::Cloudsway => ['timeout'],
            self::Magic => ['timeout'],
        };
    }

    /**
     * 获取配置示例.
     */
    public function getConfigExample(): array
    {
        return match ($this) {
            self::Cloudsway => [
                'name' => 'cloudsway',
                'enable' => true,
                'base_url' => 'https://searchapi.cloudsway.net/search/HcAMcybqJTnDtGiJ/read',
                'api_key' => 'your_api_key_here',
                'timeout' => 30,
            ],
            self::Magic => [
                'name' => 'magic',
                'enable' => true,
                'request_url' => 'https://your-magic-domain.com/v2/web-scrape',
                'api_key' => 'your_access_token_here',
                'timeout' => 30,
            ],
        };
    }

    /**
     * 获取实现类的全限定类名.
     */
    public function getImplementationClass(): string
    {
        return match ($this) {
            self::Cloudsway => CloudswayWebScrape::class,
            self::Magic => MagicWebScrape::class,
        };
    }

    /**
     * 从字符串值获取枚举实例.
     */
    public static function fromString(string $value): ?self
    {
        return self::tryFrom($value);
    }

    /**
     * 获取所有支持的提供商列表.
     *
     * @return array<string, array>
     */
    public static function getAllProviders(): array
    {
        $providers = [];
        foreach (self::cases() as $provider) {
            $providers[$provider->value] = [
                'name' => $provider->getName(),
                'description' => $provider->getDescription(),
                'required_fields' => $provider->getRequiredFields(),
                'optional_fields' => $provider->getOptionalFields(),
                'config_example' => $provider->getConfigExample(),
            ];
        }
        return $providers;
    }
}
