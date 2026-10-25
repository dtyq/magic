<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability;

/**
 * Seedance 2.0 与 2.0 pro。
 *
 * 这是 2.0 系列里唯一开放 4K 的档位；mini / fast 由 20MiniFast 家族承接，
 * 这里显式排除，保证两个家族的能力判定互不重叠。
 */
readonly class Seedance20GenerationCapabilityProvider extends AbstractSeedanceGenerationCapabilityProvider
{
    /**
     * @var list<string>
     */
    protected const array MODEL_MARKERS = [
        'seedance-2.0',
        'seedance-2-0',
    ];

    /**
     * @var list<string>
     */
    protected const array EXCLUDED_MARKERS = [
        'seedance-2.0-mini',
        'seedance-2-0-mini',
        'seedance-2.0-fast',
        'seedance-2-0-fast',
    ];

    protected function resolveProfile(): array
    {
        return [
            'resolutions' => ['480p', '720p', '1080p', '4k'],
            'durations' => ['min' => 4, 'max' => 15, 'step' => 1],
            'reference_limits' => ['images' => 9, 'videos' => 3, 'audios' => 3],
        ];
    }
}
