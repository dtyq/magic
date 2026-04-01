<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\Infrastructure\Core\AbstractDTO;

class VideoOperationErrorDTO extends AbstractDTO
{
    protected ?string $code = null;

    protected ?string $message = null;

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(?string $code): void
    {
        $this->code = $code;
    }

    public function getMessage(): ?string
    {
        return $this->message;
    }

    public function setMessage(?string $message): void
    {
        $this->message = $message;
    }

    public function toArray(): array
    {
        return array_filter(
            parent::toArray(),
            static fn (mixed $value): bool => $value !== null && $value !== ''
        );
    }
}
