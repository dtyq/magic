<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Response;

use JsonSerializable;

final readonly class OfficialSkillImportResultDTO implements JsonSerializable
{
    public function __construct(
        private string $code,
        private string $version,
        private string $action,
        private ?int $marketId,
        private ?int $versionId,
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'code' => $this->code,
            'version' => $this->version,
            'action' => $this->action,
            'id' => (string) $this->marketId,
            'version_id' => (string) $this->versionId,
        ];
    }

    public function getMarketId(): ?int
    {
        return $this->marketId;
    }

    public function getAction(): string
    {
        return $this->action;
    }
}
