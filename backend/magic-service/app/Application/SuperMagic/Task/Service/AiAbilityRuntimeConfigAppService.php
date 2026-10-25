<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Application\Kernel\Service\PlatformSettingsAppService;
use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use Hyperf\Coroutine\Parallel;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * AI 能力运行时配置应用服务.
 */
readonly class AiAbilityRuntimeConfigAppService
{
    private const RUNTIME_ABILITY_KEY_MAP = [
        AiAbilityCode::VisualUnderstanding->value => 'visual_understanding',
        AiAbilityCode::VideoUnderstanding->value => 'video_understanding',
        AiAbilityCode::ContentSummary->value => 'summarize',
        AiAbilityCode::DeepWrite->value => 'deep_write',
        AiAbilityCode::Purify->value => 'purify',
        AiAbilityCode::SmartFilename->value => 'smart_filename',
        AiAbilityCode::Compact->value => 'compact',
        AiAbilityCode::AnalysisAudio->value => 'analysis_audio',
        AiAbilityCode::FollowUpQuestions->value => 'follow_up_questions',
    ];

    /**
     * 初始化 AI 能力运行时配置应用服务.
     */
    public function __construct(
        private AiAbilityDomainService $aiAbilityDomainService,
        private PlatformSettingsAppService $platformSettingsAppService,
        private LoggerInterface $logger,
    ) {
    }

    /**
     * 获取 AI 能力运行时配置.
     */
    public function getRuntimeConfig(): array
    {
        $parallel = new Parallel();
        $parallel->add(function (): array {
            try {
                $dataIsolation = ProviderDataIsolation::create()->disabled();
                return $this->buildRuntimeConfigs($this->aiAbilityDomainService->getAll($dataIsolation));
            } catch (Throwable $throwable) {
                $this->logger->warning('获取 AI 能力运行时配置失败', [
                    'error' => $throwable->getMessage(),
                ]);
                return [];
            }
        }, 'ai_abilities');
        $parallel->add(function (): string {
            try {
                return $this->platformSettingsAppService->get()->getGlobalSystemPrompt();
            } catch (Throwable $throwable) {
                $this->logger->warning('获取全局系统提示词失败', [
                    'error' => $throwable->getMessage(),
                ]);
                return '';
            }
        }, 'global_system_prompt');
        $result = $parallel->wait();

        return [
            'ai_abilities' => (array) ($result['ai_abilities'] ?? []),
            'global_system_prompt' => (string) ($result['global_system_prompt'] ?? ''),
        ];
    }

    /**
     * 将 AI 能力实体列表转换为运行时配置映射.
     *
     * @param array<AiAbilityEntity> $aiAbilities
     */
    public function buildRuntimeConfigs(array $aiAbilities): array
    {
        $runtimeConfigs = [];

        foreach ($aiAbilities as $aiAbility) {
            if (! $aiAbility instanceof AiAbilityEntity) {
                continue;
            }

            $abilityKey = self::abilityKeyForCode($aiAbility->getCode());
            if ($abilityKey === null) {
                continue;
            }

            $runtimeConfigs[$abilityKey] = $this->buildRuntimeConfig($aiAbility);
        }

        return $runtimeConfigs;
    }

    /**
     * 将 provider 能力编码转换为 super-magic 运行时能力 key.
     */
    private static function abilityKeyForCode(AiAbilityCode $code): ?string
    {
        return self::RUNTIME_ABILITY_KEY_MAP[$code->value] ?? null;
    }

    /**
     * 构建单个 AI 能力的运行时配置.
     */
    private function buildRuntimeConfig(AiAbilityEntity $aiAbility): array
    {
        return [
            'enabled' => $aiAbility->isEnabled(),
            'config' => $aiAbility->getConfig(),
        ];
    }
}
