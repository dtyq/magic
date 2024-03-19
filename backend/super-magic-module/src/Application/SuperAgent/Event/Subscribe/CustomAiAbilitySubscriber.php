<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DynamicConfig\DynamicConfigManager;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskBeforeEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;

#[Listener(priority: 2)]
class CustomAiAbilitySubscriber implements ListenerInterface
{
    private DynamicConfigManager $dynamicConfigManager;

    private AiAbilityDomainService $aiAbilityDomainService;

    public function __construct(ContainerInterface $container)
    {
        $this->dynamicConfigManager = $container->get(DynamicConfigManager::class);
        $this->aiAbilityDomainService = $container->get(AiAbilityDomainService::class);
    }

    public function listen(): array
    {
        return [
            RunTaskBeforeEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof RunTaskBeforeEvent) {
            return;
        }
        if (! $event->getTaskId()) {
            return;
        }

        $dataIsolation = ProviderDataIsolation::create()->disabled();
        // 获取目前设置的 AI 能力动态配置
        $aiAbilities = $this->aiAbilityDomainService->getAll($dataIsolation);

        $dynamicConfig = [];
        foreach ($aiAbilities as $aiAbility) {
            if (! $aiAbility->isEnabled()) {
                continue;
            }
            switch ($aiAbility->getCode()) {
                case AiAbilityCode::VisualUnderstanding:
                    $dynamicConfig['visual_understanding'] = [
                        'model_id' => $aiAbility->getConfig()['model_id'] ?? '',
                    ];
                    break;
                case AiAbilityCode::ContentSummary:
                    $dynamicConfig['summarize'] = [
                        'model_id' => $aiAbility->getConfig()['model_id'] ?? '',
                    ];
                    break;
                case AiAbilityCode::DeepWrite:
                    $dynamicConfig['deep_write'] = [
                        'model_id' => $aiAbility->getConfig()['model_id'] ?? '',
                    ];
                    break;
                case AiAbilityCode::Purify:
                    $dynamicConfig['purify'] = [
                        'model_id' => $aiAbility->getConfig()['model_id'] ?? '',
                    ];
                    break;
                case AiAbilityCode::SmartFilename:
                    $dynamicConfig['analysis_slide'] = [
                        'model_id' => $aiAbility->getConfig()['model_id'] ?? '',
                    ];
                    break;
                case AiAbilityCode::Compact:
                    $dynamicConfig['compact'] = [
                        'model_id' => $aiAbility->getConfig()['model_id'] ?? '',
                    ];
                    break;
                case AiAbilityCode::AnalysisAudio:
                    $dynamicConfig['analysis_audio'] = [
                        'model_id' => $aiAbility->getConfig()['model_id'] ?? '',
                    ];
                    break;
                default:
                    break;
            }
        }

        // 添加到动态配置管理器中
        $this->dynamicConfigManager->addByTaskId($event->getTaskId(), 'ai_abilities', $dynamicConfig);
    }
}
