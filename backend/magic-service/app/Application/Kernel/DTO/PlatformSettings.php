<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\DTO;

class PlatformSettings
{
    private string $defaultLanguage = 'zh_CN';

    private string $faviconUrl = '';

    /**
     * @var array<string,string> key: locale, value: url
     */
    private array $logoUrls = [];

    private string $minimalLogoUrl = '';

    /** @var array<string,string> */
    private array $nameI18n = [];

    /** @var array<string,string> */
    private array $titleI18n = [];

    /** @var array<string,string> */
    private array $keywordsI18n = [];

    /** @var array<string,string> */
    private array $descriptionI18n = [];

    /** @var array<string,string> */
    private array $agentRoleNameI18n = [];

    /** @var array<string,string> */
    private array $agentRoleDescriptionI18n = [];

    /**
     * [运营规则]
     * 允许配置自定义服务商的组织白名单。
     * 空数组表示全部禁止自定义服务商。
     *
     * @var string[]
     */
    private array $customServiceProviderWhitelist = [];

    public function getDefaultLanguage(): string
    {
        return $this->defaultLanguage;
    }

    public function setDefaultLanguage(string $defaultLanguage): void
    {
        $this->defaultLanguage = $defaultLanguage ?: 'zh_CN';
    }

    public function getFaviconUrl(): string
    {
        return $this->faviconUrl;
    }

    public function setFaviconUrl(string $faviconUrl): void
    {
        $this->faviconUrl = $faviconUrl;
    }

    /**
     * @return array<string,string>
     */
    public function getLogoUrls(): array
    {
        return $this->logoUrls;
    }

    /**
     * @param array<string,string> $logoUrls
     */
    public function setLogoUrls(array $logoUrls): void
    {
        $this->logoUrls = $logoUrls;
    }

    public function getMinimalLogoUrl(): string
    {
        return $this->minimalLogoUrl;
    }

    public function setMinimalLogoUrl(string $minimalLogoUrl): void
    {
        $this->minimalLogoUrl = $minimalLogoUrl;
    }

    /**
     * @return array<string,string>
     */
    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    /**
     * @param array<string,string> $nameI18n
     */
    public function setNameI18n(array $nameI18n): void
    {
        $this->nameI18n = $nameI18n;
    }

    /**
     * @return array<string,string>
     */
    public function getTitleI18n(): array
    {
        return $this->titleI18n;
    }

    /**
     * @param array<string,string> $titleI18n
     */
    public function setTitleI18n(array $titleI18n): void
    {
        $this->titleI18n = $titleI18n;
    }

    /**
     * @return array<string,string>
     */
    public function getKeywordsI18n(): array
    {
        return $this->keywordsI18n;
    }

    /**
     * @param array<string,string> $keywordsI18n
     */
    public function setKeywordsI18n(array $keywordsI18n): void
    {
        $this->keywordsI18n = $keywordsI18n;
    }

    /**
     * @return array<string,string>
     */
    public function getDescriptionI18n(): array
    {
        return $this->descriptionI18n;
    }

    /**
     * @param array<string,string> $descriptionI18n
     */
    public function setDescriptionI18n(array $descriptionI18n): void
    {
        $this->descriptionI18n = $descriptionI18n;
    }

    /**
     * @return array<string,string>
     */
    public function getAgentRoleNameI18n(): array
    {
        return $this->agentRoleNameI18n;
    }

    /**
     * @param array<string,string> $agentRoleNameI18n
     */
    public function setAgentRoleNameI18n(array $agentRoleNameI18n): void
    {
        $this->agentRoleNameI18n = $agentRoleNameI18n;
    }

    /**
     * @return array<string,string>
     */
    public function getAgentRoleDescriptionI18n(): array
    {
        return $this->agentRoleDescriptionI18n;
    }

    /**
     * @param array<string,string> $agentRoleDescriptionI18n
     */
    public function setAgentRoleDescriptionI18n(array $agentRoleDescriptionI18n): void
    {
        $this->agentRoleDescriptionI18n = $agentRoleDescriptionI18n;
    }

    /**
     * @return string[]
     */
    public function getCustomServiceProviderWhitelist(): array
    {
        return $this->customServiceProviderWhitelist;
    }

    /**
     * @param string[] $customServiceProviderWhitelist
     */
    public function setCustomServiceProviderWhitelist(array $customServiceProviderWhitelist): void
    {
        $this->customServiceProviderWhitelist = array_values(array_filter(array_unique($customServiceProviderWhitelist)));
    }

    public function isCustomServiceProviderAllowed(string $organizationCode): bool
    {
        return in_array($organizationCode, $this->customServiceProviderWhitelist, true);
    }

    public function toArray(): array
    {
        return [
            'default_language' => $this->defaultLanguage,
            'favicon_url' => $this->faviconUrl,
            'logo_urls' => $this->logoUrls,
            'minimal_logo_url' => $this->minimalLogoUrl,
            'name_i18n' => $this->nameI18n,
            'title_i18n' => $this->titleI18n,
            'keywords_i18n' => $this->keywordsI18n,
            'description_i18n' => $this->descriptionI18n,
            'agent_role_name_i18n' => $this->agentRoleNameI18n,
            'agent_role_description_i18n' => $this->agentRoleDescriptionI18n,
            'custom_service_provider_whitelist' => $this->customServiceProviderWhitelist,
        ];
    }

    public static function fromArray(array $data): self
    {
        $i = new self();
        $i->setDefaultLanguage((string) ($data['default_language'] ?? 'zh_CN'));
        $i->setFaviconUrl((string) ($data['favicon_url'] ?? ''));
        $i->setLogoUrls((array) ($data['logo_urls'] ?? []));
        $i->setMinimalLogoUrl((string) ($data['minimal_logo_url'] ?? ''));
        $i->setNameI18n((array) ($data['name_i18n'] ?? []));
        $i->setTitleI18n((array) ($data['title_i18n'] ?? []));
        $i->setKeywordsI18n((array) ($data['keywords_i18n'] ?? []));
        $i->setDescriptionI18n((array) ($data['description_i18n'] ?? []));
        $i->setAgentRoleNameI18n((array) ($data['agent_role_name_i18n'] ?? []));
        $i->setAgentRoleDescriptionI18n((array) ($data['agent_role_description_i18n'] ?? []));
        $i->setCustomServiceProviderWhitelist((array) (
            $data['custom_service_provider_whitelist']
            ?? $data['foreign_provider_org_whitelist']
            ?? []
        ));
        return $i;
    }
}
