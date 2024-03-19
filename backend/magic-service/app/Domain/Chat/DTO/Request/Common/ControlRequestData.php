<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Request\Common;

use App\Domain\Chat\Entity\AbstractEntity;

class ControlRequestData extends AbstractEntity
{
    protected Message $message;

    protected string $requestId;

    protected string $referMessageId;

    public function __construct(array $data)
    {
        parent::__construct($data);
    }

    public function getReferMessageId(): string
    {
        return $this->referMessageId ?? '';
    }

    public function setReferMessageId(?string $referMessageId): void
    {
        $this->referMessageId = $referMessageId ?? '';
    }

    public function getMessage(): Message
    {
        return $this->message;
    }

    public function setMessage(array|Message $message): void
    {
        if ($message instanceof Message) {
            $this->message = $message;
        } else {
            $this->message = new Message($message);
        }
    }

    public function getRequestId(): string
    {
        return $this->requestId ?? '';
    }

    public function setRequestId(?string $requestId): void
    {
        $this->requestId = $requestId ?? '';
    }
}
