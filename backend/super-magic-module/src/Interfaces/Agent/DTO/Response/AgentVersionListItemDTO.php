<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\OperatorDTO;

class AgentVersionListItemDTO extends AbstractDTO
{
    public function __construct(
        private readonly string $id,
        private readonly string $version,
        private readonly string $publishStatus,
        private readonly string $reviewStatus,
        private readonly string $publishTargetType,
        private readonly ?OperatorDTO $publisher,
        private readonly ?string $publishedAt,
        private readonly bool $isCurrentVersion,
        private readonly ?array $versionDescriptionI18n,
        private readonly ?array $publishTargetValue = null,
    ) {
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'version' => $this->version,
            'publish_status' => $this->publishStatus,
            'review_status' => $this->reviewStatus,
            'publish_target_type' => $this->publishTargetType,
            'publisher' => $this->publisher?->toArray(),
            'published_at' => $this->publishedAt,
            'is_current_version' => $this->isCurrentVersion,
            'version_description_i18n' => $this->versionDescriptionI18n,
            'publish_target_value' => $this->publishTargetValue,
        ];
    }
}
