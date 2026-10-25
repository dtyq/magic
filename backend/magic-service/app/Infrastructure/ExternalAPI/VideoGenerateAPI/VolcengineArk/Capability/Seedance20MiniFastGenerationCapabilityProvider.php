<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability;

/**
 * Seedance 2.0 mini / 2.0 fast。
 *
 * 目前根据 provider 实际返回，这两个型号的 t2v 仅开放到 720p。
 */
readonly class Seedance20MiniFastGenerationCapabilityProvider extends AbstractSeedanceGenerationCapabilityProvider
{
    /**
     * @var list<string>
     */
    protected const array MODEL_MARKERS = [
        'seedance-2.0-mini',
        'seedance-2-0-mini',
        'seedance-2.0-fast',
        'seedance-2-0-fast',
    ];

    protected function resolveProfile(): array
    {
        return [
            'resolutions' => ['480p', '720p'],
            'durations' => ['min' => 4, 'max' => 15, 'step' => 1],
            'reference_limits' => ['images' => 9, 'videos' => 3, 'audios' => 3],
        ];
    }
}
