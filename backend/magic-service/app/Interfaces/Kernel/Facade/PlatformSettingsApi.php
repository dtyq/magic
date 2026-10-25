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
use App\Application\Permission\Service\RoleAppService;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Kernel\DTO\Request\PlatformSettingsUpdateRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use InvalidArgumentException;

#[ApiResponse('low_code')]
class PlatformSettingsApi
{
    use MagicUserAuthorizationTrait;

    public function __construct(
        private readonly PlatformSettingsAppService $platformSettingsAppService,
        private readonly RoleAppService $roleAppService,
    ) {
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SETTING_PLATFORM_INFO, MagicOperationEnum::QUERY)]
    public function show(): array
    {
        $settings = $this->platformSettingsAppService->getPersisted()->toArray();
        return self::platformSettingsToResponse($settings);
    }

    /** 合并平台配置，参考金额由配置层统一生成后保存。 */
    #[CheckPermission(MagicResourceEnum::PLATFORM_SETTING_PLATFORM_INFO, MagicOperationEnum::EDIT)]
    public function update(PlatformSettingsUpdateRequest $request): array
    {
        $payload = $request->validated();
        if (isset($payload['model_billing_multiplier'])) {
            $authorization = $this->getAuthorization();
            $dataIsolation = PermissionDataIsolation::create($authorization->getOrganizationCode(), $authorization->getId());
            if (! $this->roleAppService->hasPermission($dataIsolation, $authorization->getId(), MagicResourceEnum::PLATFORM_AI_MODEL_MULTIPLIER->value . '.' . MagicOperationEnum::EDIT->value)) {
                ExceptionBuilder::throw(PermissionErrorCode::AccessDenied, 'permission.error.access_denied');
            }
        }
        $settings = $this->platformSettingsAppService->update(fn (PlatformSettings $existing): PlatformSettings => $this->applyUpdate($existing, $payload));
        return self::platformSettingsToResponse($settings->toArray());
    }

    /** 只合并当前请求提供的字段，读取与保存处于同一更新临界区。 */
    private function applyUpdate(PlatformSettings $existing, array $payload): PlatformSettings
    {
        $data = $existing->toArray();

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
        if (! empty($payload['agent_role_name_i18n'] ?? [])) {
            $data['agent_role_name_i18n'] = (array) $payload['agent_role_name_i18n'];
        }
        if (! empty($payload['agent_role_description_i18n'] ?? [])) {
            $data['agent_role_description_i18n'] = (array) $payload['agent_role_description_i18n'];
        }
        if (array_key_exists('global_system_prompt', $payload)) {
            $data['global_system_prompt'] = (string) $payload['global_system_prompt'];
        }
        if (array_key_exists('custom_service_provider_whitelist', $payload)) {
            $data['custom_service_provider_whitelist'] = (array) ($payload['custom_service_provider_whitelist'] ?? []);
        }
        if (array_key_exists('footer', $payload) && is_array($payload['footer'])) {
            $data['footer'] = self::mergeFooterSettings((array) ($data['footer'] ?? []), $payload['footer']);
        }
        if (array_key_exists('watermark', $payload) && is_array($payload['watermark'])) {
            $data['watermark'] = array_replace((array) ($data['watermark'] ?? []), $payload['watermark']);
        }

        if (isset($payload['model_billing_multiplier'])) {
            try {
                $data['model_billing_multiplier'] = $existing->getModelBillingMultiplier()->withOverrides($payload['model_billing_multiplier'])->toArray();
            } catch (InvalidArgumentException) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'platform_settings.invalid_model_billing_multiplier');
            }
        }

        $this->validateUrls($data);
        $this->validateFooter($data);

        return PlatformSettings::fromArray($data);
    }

    /**
     * 简单 URL 与必填项校验（遵循需求：保存 URL；大小/类型校验在文件服务与前端处理）。
     */
    private function validateUrls(array $data): void
    {
        $urls = [];
        $urls[] = $data['favicon_url'] ?? '';
        $urls[] = $data['logo_urls']['zh_CN'] ?? '';
        $urls[] = $data['logo_urls']['en_US'] ?? '';
        $urls[] = $data['minimal_logo_url'] ?? '';
        $urls[] = $data['footer']['filing']['link'] ?? '';
        foreach ($urls as $u) {
            if ($u !== '' && ! str_starts_with($u, 'https://') && ! str_starts_with($u, 'http://')) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'platform_settings.invalid_url');
            }
        }
    }

    private function validateFooter(array $data): void
    {
        $filing = (array) ($data['footer']['filing'] ?? []);
        if ((bool) ($filing['enabled'] ?? false) && trim((string) ($filing['number'] ?? '')) === '') {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'platform_settings.validation_failed');
        }
    }

    private static function platformSettingsToResponse(array $settings): array
    {
        $logo = [];
        foreach (($settings['logo_urls'] ?? []) as $locale => $url) {
            $logo[$locale] = $url;
        }
        $favicon = null;
        if (! empty($settings['favicon_url'] ?? '')) {
            $favicon = (string) $settings['favicon_url'];
        }
        $minimalLogo = null;
        if (! empty($settings['minimal_logo_url'] ?? '')) {
            $minimalLogo = (string) $settings['minimal_logo_url'];
        }
        $resp = [
            'model_billing_multiplier' => PlatformSettings::fromArray($settings)->getModelBillingMultiplier()->toArray(),
            'logo' => $logo,
            'favicon' => $favicon,
            'minimal_logo' => $minimalLogo,
            'default_language' => (string) ($settings['default_language'] ?? 'zh_CN'),
            'footer' => PlatformSettings::fromArray($settings)->getFooter(),
            'watermark' => (array) ($settings['watermark'] ?? [
                'enabled' => false,
                'fields' => ['real_name'],
                'depth' => 'light',
            ]),
        ];
        foreach (['name_i18n', 'title_i18n', 'keywords_i18n', 'description_i18n', 'agent_role_name_i18n', 'agent_role_description_i18n'] as $key) {
            if (isset($settings[$key])) {
                $resp[$key] = (array) $settings[$key];
            }
        }
        $resp['global_system_prompt'] = (string) ($settings['global_system_prompt'] ?? '');
        $resp['custom_service_provider_whitelist'] = (array) ($settings['custom_service_provider_whitelist'] ?? []);
        return $resp;
    }

    /**
     * @param array{
     *     copyright_i18n?: array<string,mixed>,
     *     filing?: array{enabled?: mixed, number?: mixed, link?: mixed}
     * } $existing
     * @param array{
     *     copyright_i18n?: array<string,mixed>,
     *     filing?: array{enabled?: mixed, number?: mixed, link?: mixed}
     * } $payload
     * @return array{
     *     copyright_i18n?: array<string,mixed>,
     *     filing?: array{enabled?: mixed, number?: mixed, link?: mixed}
     * }
     */
    private static function mergeFooterSettings(array $existing, array $payload): array
    {
        if (array_key_exists('copyright_i18n', $payload)) {
            $existing['copyright_i18n'] = (array) $payload['copyright_i18n'];
        }

        if (array_key_exists('filing', $payload) && is_array($payload['filing'])) {
            $existing['filing'] = (array) ($existing['filing'] ?? []);
            $filingPayload = (array) $payload['filing'];

            if (array_key_exists('enabled', $filingPayload)) {
                $existing['filing']['enabled'] = (bool) $filingPayload['enabled'];
            }
            if (array_key_exists('number', $filingPayload)) {
                $existing['filing']['number'] = (string) ($filingPayload['number'] ?? '');
            }
            if (array_key_exists('link', $filingPayload)) {
                $existing['filing']['link'] = (string) ($filingPayload['link'] ?? '');
            }
        }

        return $existing;
    }
}
