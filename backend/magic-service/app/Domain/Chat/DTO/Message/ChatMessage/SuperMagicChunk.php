<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

class SuperMagicChunk extends MagicMessageStruct implements MessageInterface
{
    protected ?array $choices = null;

    protected null|int|string $created = null;

    protected ?string $id = null;

    protected ?string $model = null;

    protected ?string $object = null;

    protected ?array $usage = null;

    protected ?string $correlationId = null;

    /**
     * chunk 序号.
     */
    protected ?int $i = null;

    public function toArray(bool $filterNull = false): array
    {
        $data = [
            'choices' => $this->choices,
            'created' => $this->created,
            'id' => $this->id,
            'model' => $this->model,
            'object' => $this->object,
            'usage' => $this->usage,
            'correlation_id' => $this->correlationId,
            'i' => $this->i,
        ];

        return $filterNull ? array_filter($data, fn ($value) => ! is_null($value)) : $data;
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::SuperMagicChunk;
    }
}
