<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Speech\Entity\Dto;

use App\Infrastructure\Core\AbstractDTO;

class SpeechCorpusDTO extends AbstractDTO
{
    protected ?string $boostingTableName = null;

    protected ?string $context = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getBoostingTableName(): ?string
    {
        return $this->boostingTableName;
    }

    public function setBoostingTableName(?string $boostingTableName): void
    {
        $this->boostingTableName = $boostingTableName;
    }

    public function getContext(): ?string
    {
        return $this->context;
    }

    public function setContext(?string $context): void
    {
        $this->context = $context;
    }
}
