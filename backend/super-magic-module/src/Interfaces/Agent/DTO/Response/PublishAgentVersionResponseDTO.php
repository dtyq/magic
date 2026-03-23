<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class PublishAgentVersionResponseDTO extends AbstractDTO
{
    public function __construct(
        private readonly string $versionId,
        private readonly string $version,
        private readonly string $publishStatus,
        private readonly string $reviewStatus,
        private readonly string $publishTargetType,
        private readonly bool $isCurrentVersion,
        private readonly ?string $publishedAt,
    ) {
    }

    public function toArray(): array
    {
        return [
            'version_id' => $this->versionId,
            'version' => $this->version,
            'publish_status' => $this->publishStatus,
            'review_status' => $this->reviewStatus,
            'publish_target_type' => $this->publishTargetType,
            'is_current_version' => $this->isCurrentVersion,
            'published_at' => $this->publishedAt,
        ];
    }
}
