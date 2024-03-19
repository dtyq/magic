<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Response;

use App\Domain\Chat\DTO\Response\Common\ClientSequence;
use App\Domain\Chat\Entity\AbstractEntity;

class ClientSequenceResponse extends AbstractEntity
{
    protected string $type;

    protected ClientSequence $seq;

    public function __construct(array $data)
    {
        parent::__construct($data);
    }

    public function toArray(): array
    {
        return [
            'type' => $this->type,
            'seq' => $this->seq->toArray(),
        ];
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getSeq(): ClientSequence
    {
        return $this->seq;
    }

    public function setSeq(array|ClientSequence $seq): void
    {
        if ($seq instanceof ClientSequence) {
            $this->seq = $seq;
        } else {
            $this->seq = new ClientSequence($seq);
        }
    }
}
