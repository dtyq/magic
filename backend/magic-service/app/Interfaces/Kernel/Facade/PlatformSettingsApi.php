<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\Facade;

use App\Application\Kernel\DTO\PlatformSettings;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\Service\PlatformSettingsAppService;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Kernel\DTO\Request\PlatformSettingsUpdateRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse('low_code')]
class PlatformSettingsApi
{
    use MagicUserAuthorizationTrait;

    public function __construct(
        private readonly PlatformSettingsAppService $platformSettingsAppService,
    ) {
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SETTING_PLATFORM_INFO, MagicOperationEnum::QUERY)]
    public function show(): array
    {
        $settings = $this->platformSettingsAppService->get()->toArray();
        return self::platformSettingsToResponse($settings);
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SETTING_PLATFORM_INFO, MagicOperationEnum::EDIT)]
    public function update(PlatformSettingsUpdateRequest $request): array
    {
        $existing = $this->platformSettingsAppService->get();
        $data = $existing->toArray();

        $payload = $request->validated();

        // 允许部分字段更新：仅当传入非空时替换
        if (array_key_exists('logo_zh_url', $payload) && $payload['logo_zh_url'] !== null) {
            $data['logo_urls']['zh_CN'] = (string) $payload['logo_zh_url'];
        }
        if (array_key_exists('logo_en_url', $payload) && $payload['logo_en_url'] !== null) {
            $data['logo_urls']['en_US'] = (string) $payload['logo_en_url'];
        }
        if (array_key_exists('favicon_url', $payload) && $payload['favicon_url'] !== null) {
            $data['favicon_url'] = (string) $payload['favicon_url'];
        }
        if (array_key_exists('minimal_logo_url', $payload) && $payload['minimal_logo_url'] !== null) {
            $data['minimal_logo_url'] = (string) $payload['minimal_logo_url'];
        }
        if (array_key_exists('default_language', $payload) && $payload['default_language'] !== null) {
            $data['default_language'] = (string) $payload['default_language'];
        }
        if (! empty($payload['name_i18n'] ?? [])) {
            $data['name_i18n'] = (array) $payload['name_i18n'];
        }
        if (! empty($payload['title_i18n'] ?? [])) {
            $data['title_i18n'] = (array) $payload['title_i18n'];
        }
        if (! empty($payload['keywords_i18n'] ?? [])) {
            $data['keywords_i18n'] = (array) $payload['keywords_i18n'];
        }
        if (! empty($payload['description_i18n'] ?? [])) {
            $data['description_i18n'] = (array) $payload['description_i18n'];
        }

        $this->validateUrls($data);

        $settings = PlatformSettings::fromArray($data);
        $this->platformSettingsAppService->save($settings);
        return self::platformSettingsToResponse($settings->toArray());
    }

    /**
     * 简单 URL 与必填项校验（遵循需求：保存 URL；大小/类型校验在文件服务与前端处理）。
     */
    private function validateUrls(array $data): void
    {
        foreach (['favicon_url'] as $key) {
            if (empty($data[$key])) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'platform_settings.validation_failed');
            }
        }
        // 简单 https 检查
        $urls = [];
        $urls[] = $data['favicon_url'] ?? '';
        $urls[] = $data['logo_urls']['zh_CN'] ?? '';
        $urls[] = $data['logo_urls']['en_US'] ?? '';
        $urls[] = $data['minimal_logo_url'] ?? '';
        foreach ($urls as $u) {
            if ($u !== '' && ! str_starts_with($u, 'https://')) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'platform_settings.invalid_url');
            }
        }
    }

    private static function platformSettingsToResponse(array $settings): array
    {
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
