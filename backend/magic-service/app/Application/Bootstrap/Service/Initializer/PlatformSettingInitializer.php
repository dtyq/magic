<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Bootstrap\Service\Initializer;

use App\Application\Kernel\DTO\PlatformSettings;
use App\Application\Kernel\Service\PlatformSettingsAppService;
use App\Infrastructure\Util\Context\CoContext;

class PlatformSettingInitializer
{
    private const SUPPORTED_LANGUAGES = ['zh_CN', 'en_US'];

    public function __construct(
        private readonly PlatformSettingsAppService $platformSettingsAppService,
    ) {
    }

    /**
     * @param array<string, mixed> $agentInfo
     * @return array{
     *   success:bool,
     *   language:string,
     *   is_skipped:bool,
     *   is_idempotent_replay:bool
     * }
     */
    public function initialize(array $agentInfo, string $agentName, string $agentDescription): array
    {
        $language = $this->resolveLanguage();
        $normalizedName = trim($agentName);
        $normalizedDescription = trim($agentDescription);

        $hasName = $normalizedName !== '';
        $hasDescription = $normalizedDescription !== '';

        if ($agentInfo === [] || (! $hasName && ! $hasDescription)) {
            return [
                'success' => true,
                'language' => $language,
                'is_skipped' => true,
                'is_idempotent_replay' => true,
            ];
        }

        $settings = $this->platformSettingsAppService->get();
        $settingsData = $settings->toArray();
        $changed = false;

        if ($hasName) {
            $nameI18n = (array) ($settingsData['name_i18n'] ?? []);
            if (($nameI18n[$language] ?? '') !== $normalizedName) {
                $nameI18n[$language] = $normalizedName;
                $settingsData['name_i18n'] = $nameI18n;
                $changed = true;
            }

            $agentRoleNameI18n = (array) ($settingsData['agent_role_name_i18n'] ?? []);
            if (($agentRoleNameI18n[$language] ?? '') !== $normalizedName) {
                $agentRoleNameI18n[$language] = $normalizedName;
                $settingsData['agent_role_name_i18n'] = $agentRoleNameI18n;
                $changed = true;
            }
        }

        if ($hasDescription) {
            $agentRoleDescriptionI18n = (array) ($settingsData['agent_role_description_i18n'] ?? []);
            if (($agentRoleDescriptionI18n[$language] ?? '') !== $normalizedDescription) {
                $agentRoleDescriptionI18n[$language] = $normalizedDescription;
                $settingsData['agent_role_description_i18n'] = $agentRoleDescriptionI18n;
                $changed = true;
            }
        }

        if ($changed) {
            $this->platformSettingsAppService->save(PlatformSettings::fromArray($settingsData));
        }

        return [
            'success' => true,
            'language' => $language,
            'is_skipped' => false,
            'is_idempotent_replay' => ! $changed,
        ];
    }

    private function resolveLanguage(): string
    {
        $language = str_replace('-', '_', trim(CoContext::getLanguage()));
        if ($language === '') {
            return 'zh_CN';
        }

        if (in_array($language, self::SUPPORTED_LANGUAGES, true)) {
            return $language;
        }

        return 'zh_CN';
    }
}
