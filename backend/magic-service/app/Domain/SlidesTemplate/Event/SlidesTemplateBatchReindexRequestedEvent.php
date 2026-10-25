<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Event;

final readonly class SlidesTemplateBatchReindexRequestedEvent
{
    /**
     * @param array<string> $slidesTemplateIds
     */
    public function __construct(
        public array $slidesTemplateIds,
        public string $organizationCode,
        public string $operatorId,
        public bool $forceReEmbedding = false,
    ) {
    }
}
