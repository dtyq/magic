<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception;

use RuntimeException;
use Throwable;

/**
 * Event exception class for handling event-related errors
 * Used specifically for event delivery and consumption failures.
 */
class EventException extends RuntimeException
{
    private ?string $eventType = null;

    private ?array $data = null;

    public function __construct(string $message = '', int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }

    public function setMessage(string $message): void
    {
        $this->message = $message;
    }

    /**
     * Set event type for better error tracking.
     */
    public function setEventType(string $eventType): self
    {
        $this->eventType = $eventType;
        return $this;
    }

    /**
     * Set event data for debugging purposes.
     */
    public function setData(array $data): self
    {
        $this->data = $data;
        return $this;
    }

    public function getEventType(): ?string
    {
        return $this->eventType;
    }

    public function getData(): ?array
    {
        return $this->data;
    }

    /**
     * Get formatted error context for logging.
     */
    public function getErrorContext(): array
    {
        return [
            'event_type' => $this->eventType,
            'code' => $this->getCode(),
            'message' => $this->getMessage(),
            'data' => $this->data,
        ];
    }
}
