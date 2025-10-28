<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\Facade;

use App\Application\Kernel\DTO\GlobalConfig;
use App\Application\Kernel\Service\MagicSettingAppService;
use App\Application\Kernel\Service\PlatformSettingsAppService;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Throwable;

#[ApiResponse('low_code')]
class GlobalConfigApi
{
    public function __construct(
        private readonly MagicSettingAppService $magicSettingAppService,
    ) {
    }

    public function getGlobalConfig(): array
    {
        $config = $this->magicSettingAppService->get();
        $result = $config->toArray();

        // 合并平台设置
        try {
            /** @var PlatformSettingsAppService $platformSettingsAppService */
            $platformSettingsAppService = di(PlatformSettingsAppService::class);
            $platform = $platformSettingsAppService->get();
            $result = array_merge($result, self::platformSettingsToResponse($platform->toArray()));
        } catch (Throwable $e) {
            // 忽略平台设置异常，避免影响全局配置读取
        }

        return $result;
    }

    public function updateGlobalConfig(RequestInterface $request): array
    {
        $isMaintenance = (bool) $request->input('is_maintenance', false);
        $description = (string) $request->input('maintenance_description', '');

        $config = new GlobalConfig();
        $config->setIsMaintenance($isMaintenance);
        $config->setMaintenanceDescription($description);

        $this->magicSettingAppService->save($config);

        return $config->toArray();
    }

    private static function platformSettingsToResponse(array $settings): array
    {
        // 将 logo_urls 转换为前端示例结构
        $logo = [];
        foreach (($settings['logo_urls'] ?? []) as $locale => $url) {
            $logo[$locale] = ['url' => $url];
        }
        $favicon = [];
        if (! empty($settings['favicon_url'] ?? '')) {
            $favicon = ['url' => (string) $settings['favicon_url']];
        }
        $minimalLogo = [];
        if (! empty($settings['minimal_logo_url'] ?? '')) {
            $minimalLogo = ['url' => (string) $settings['minimal_logo_url']];
        }
        $resp = [
            'logo' => $logo,
            'favicon' => $favicon,
            'minimal_logo' => $minimalLogo,
            'default_language' => (string) ($settings['default_language'] ?? 'zh_CN'),
        ];
        foreach (['name_i18n', 'title_i18n', 'keywords_i18n', 'description_i18n'] as $key) {
            if (isset($settings[$key])) {
                $resp[$key] = (array) $settings[$key];
            }
        }
        return $resp;
    }
}
