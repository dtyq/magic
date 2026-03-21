<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\PublishAgentRequestDTO;

/**
 * 发布 Agent 版本表单预填（与 {@see PublishAgentRequestDTO} 字段对齐）.
 */
class AgentPublishPrefillResponseDTO extends AbstractDTO
{
    public function __construct(
        private readonly string $version,
        private readonly array $versionDescriptionI18n,
        private readonly ?string $publishTargetType,
        private readonly ?array $publishTargetValue,
    ) {
    }

    public function toArray(): array
    {
        return [
            'version' => $this->version,
            'version_description_i18n' => $this->versionDescriptionI18n,
            'publish_target_type' => $this->publishTargetType,
            'publish_target_value' => $this->publishTargetValue,
        ];
    }
}
