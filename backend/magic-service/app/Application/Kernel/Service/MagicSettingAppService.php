<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Kernel\AbstractKernelAppService;
use App\Application\Kernel\DTO\GlobalConfig;
use App\Domain\AppMenu\Entity\ValueObject\DisplayScope;
use App\Domain\AppMenu\Service\AppMenuDomainService;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use App\Infrastructure\Util\Redis\GlobalConfigCacheUtil;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use Hyperf\Redis\Redis;

class MagicSettingAppService extends AbstractKernelAppService
{
    private const string CACHE_KEY = 'magic:global_config_cache';

    public function __construct(
        private readonly MagicUserSettingDomainService $magicUserSettingDomainService,
        private readonly Redis $redis,
        private readonly AppMenuDomainService $appMenuDomainService,
    ) {
    }

    /**
     * 保存全局配置
     * 全局配置不属于任何账号、组织或用户.
     */
    public function save(GlobalConfig $config): GlobalConfig
    {
        $entity = new MagicUserSettingEntity();
        $entity->setKey(UserSettingKey::GlobalConfig->value);
        $entity->setValue($config->toArray());

        $this->magicUserSettingDomainService->saveGlobal($entity);

        // 重置缓存
        $this->redis->del(self::CACHE_KEY);
        GlobalConfigCacheUtil::deleteGlobalConfig();

        return $config;
    }

    /**
     * 获取全局配置.
     */
    public function get(): GlobalConfig
    {
        $cache = $this->redis->get(self::CACHE_KEY);
        if ($cache) {
            $data = json_decode($cache, true) ?? [];
            return GlobalConfig::fromArray($data);
        }

        $entity = $this->magicUserSettingDomainService->getGlobal(UserSettingKey::GlobalConfig->value);
        $config = $entity ? GlobalConfig::fromArray($entity->getValue()) : new GlobalConfig();

        $this->redis->set(self::CACHE_KEY, json_encode($config->toArray()));

        return $config;
    }

    /**
     * 直接从存储读取全局配置（不走缓存）.
     */
    public function getWithoutCache(): GlobalConfig
    {
        $entity = $this->magicUserSettingDomainService->getGlobal(UserSettingKey::GlobalConfig->value);
        return $entity ? GlobalConfig::fromArray($entity->getValue()) : new GlobalConfig();
    }

    /**
     * 获取菜单模块默认配置
     * 当前返回硬编码的配置，后续可从 magic_user_settings 表读取.
     *
     * @return array{personal_organization: array, team_organization: array}
     */
    public function getMenuModules(): array
    {
        return [
            'personal_organization' => [
                ['id' => 1, 'key' => 'superMagic', 'enabled' => true],
                ['id' => 2, 'key' => 'flowOrchestration', 'enabled' => true],
                ['id' => 3, 'key' => 'longTermMemory', 'enabled' => false],
                ['id' => 4, 'key' => 'archiveSpace', 'enabled' => false],
                ['id' => 5, 'key' => 'shareManagement', 'enabled' => false],
                ['id' => 6, 'key' => 'timedTasks', 'enabled' => false],
                ['id' => 7, 'key' => 'preferences', 'enabled' => false],
                ['id' => 8, 'key' => 'cloudDrive', 'enabled' => true],
                ['id' => 9, 'key' => 'knowledgeBase', 'enabled' => true],
                ['id' => 10, 'key' => 'favorites', 'enabled' => true],
            ],
            'team_organization' => [
                ['id' => 1, 'key' => 'superMagic', 'enabled' => true],
                ['id' => 2, 'key' => 'flowOrchestration', 'enabled' => true],
                ['id' => 3, 'key' => 'longTermMemory', 'enabled' => false],
                ['id' => 4, 'key' => 'archiveSpace', 'enabled' => false],
                ['id' => 5, 'key' => 'shareManagement', 'enabled' => false],
                ['id' => 6, 'key' => 'timedTasks', 'enabled' => false],
                ['id' => 7, 'key' => 'preferences', 'enabled' => false],
                ['id' => 8, 'key' => 'chat', 'enabled' => true],
                ['id' => 9, 'key' => 'contacts', 'enabled' => true],
                ['id' => 10, 'key' => 'applications', 'enabled' => true],
                ['id' => 11, 'key' => 'cloudDrive', 'enabled' => true],
                ['id' => 12, 'key' => 'knowledgeBase', 'enabled' => true],
                ['id' => 13, 'key' => 'approval', 'enabled' => true],
                ['id' => 14, 'key' => 'schedule', 'enabled' => true],
                ['id' => 15, 'key' => 'tasks', 'enabled' => true],
                ['id' => 16, 'key' => 'favorites', 'enabled' => true],
            ],
        ];
    }

    /**
     * 从数据库获取应用菜单（新接口使用）
     * 根据组织类型动态返回应用列表.
     *
     * @return array<array{id: string, name_i18n: array, icon: string, icon_url: string, icon_type: int, path: string, open_method: int, sort_order: int, display_scope: int, status: int}>
     */
    public function getAppMenuModules(OrganizationType $organizationType): array
    {
        $displayScopes = [DisplayScope::All->value];
        if ($organizationType === OrganizationType::Personal) {
            $displayScopes[] = DisplayScope::PersonalOnly->value;
        } else {
            $displayScopes[] = DisplayScope::TeamOnly->value;
        }

        $applications = $this->appMenuDomainService->getAllEnabled($displayScopes);
        $iconPaths = [];
        foreach ($applications as $application) {
            if ($application->isImageIcon() && $application->getIconUrl() !== '') {
                $iconPaths[] = $application->getIconUrl();
            }
        }
        $icons = $this->getIconsWithSmartOrganization($iconPaths);

        $result = [];
        foreach ($applications as $application) {
            $iconUrl = '';
            if ($application->isImageIcon()) {
                $iconUrl = FileAssembler::getUrl($icons[$application->getIconUrl()] ?? null);
                if ($iconUrl === '') {
                    $iconUrl = $application->getIconUrl();
                }
            }

            $result[] = [
                'id' => (string) $application->getId(),
                'name_i18n' => $application->getNameI18n(),
                'icon' => $application->getIcon(),
                'icon_url' => $iconUrl,
                'icon_type' => $application->getIconType(),
                'path' => $application->getPath(),
                'open_method' => $application->getOpenMethod(),
                'sort_order' => $application->getSortOrder(),
                'display_scope' => $application->getDisplayScope(),
                'status' => $application->getStatus(),
            ];
        }

        return $result;
    }
}
