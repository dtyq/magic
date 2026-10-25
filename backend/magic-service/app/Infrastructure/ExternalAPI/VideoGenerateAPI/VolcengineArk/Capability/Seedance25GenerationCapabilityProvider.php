<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability;

/**
 * Seedance 2.5。
 *
 * 支持到 1080p、最长 30 秒，参考素材上限显著高于 2.0 系列；
 * 是目前唯一支持显式声明视频编辑子任务类型、也是唯一支持样片模式与样片成片的家族。
 */
readonly class Seedance25GenerationCapabilityProvider extends AbstractSeedanceGenerationCapabilityProvider
{
    /**
     * @var list<string>
     */
    protected const array MODEL_MARKERS = [
        'seedance-2.5',
        'seedance-2-5',
    ];

    public function supportsEditTaskType(): bool
    {
        return true;
    }

    protected function supportsDraft(): bool
    {
        return true;
    }

    protected function supportsDraftTask(): bool
    {
        return true;
    }

    /**
     * @return list<string>
     */
    protected function supportedInputs(): array
    {
        return [...parent::supportedInputs(), 'video_draft_task'];
    }

    protected function resolveProfile(): array
    {
        return [
            'resolutions' => ['480p', '720p', '1080p'],
            'durations' => ['min' => 4, 'max' => 30, 'step' => 1],
            'reference_limits' => ['images' => 30, 'videos' => 10, 'audios' => 10],
        ];
    }
}
