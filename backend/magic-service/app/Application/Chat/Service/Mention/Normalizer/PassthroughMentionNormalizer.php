<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service\Mention\Normalizer;

use App\Application\Chat\Service\Mention\AbstractMentionNormalizer;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

/**
 * 兜底 normalizer：未识别的 mention type 原样透传。
 *
 * 由 MentionNormalizationService 在 type 未命中时默认调用。
 */
class PassthroughMentionNormalizer extends AbstractMentionNormalizer
{
    protected function enrich(array $item, BaseDataIsolation $dataIsolation): array
    {
        return [];
    }
}
