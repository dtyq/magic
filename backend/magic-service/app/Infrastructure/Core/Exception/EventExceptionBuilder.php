<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception;

use App\ErrorCode\EventErrorCode;
use Throwable;

/**
 * Event exception builder for creating event-specific exceptions
 * Provides convenient methods for building EventException with context.
 */
class EventExceptionBuilder
{
    /**
     * Throw an event exception with simplified context.
     *
     * @param EventErrorCode $errorCode The event error code
     * @param string $message Custom error message (optional)
     * @param null|string $eventType Event type for context
     * @param null|array $data Event data for context
     * @param null|Throwable $previous Previous exception
     * @return never
     */
    public static function throw(
        EventErrorCode $errorCode,
        string $message = '',
        ?string $eventType = null,
        ?array $data = null,
        ?Throwable $previous = null
    ): void {
        // Create EventException directly with the error code value
        $eventException = new EventException(
            $message ?: 'Event exception occurred',
            $errorCode->value,
            $previous
        );

        // Set event-specific context
        if ($eventType !== null) {
            $eventException->setEventType($eventType);
        }

        if ($data !== null) {
            $eventException->setData($data);
        }

        throw $eventException;
    }

    /**
     * Create event exception for consumer execution failure.
     */
    public static function consumerExecutionFailed(
        string $message = '',
        ?string $eventType = null,
        ?array $data = null,
        ?Throwable $previous = null
    ): void {
        self::throw(
            EventErrorCode::EVENT_CONSUMER_EXECUTION_FAILED,
            $message,
            $eventType,
            $data,
            $previous
        );
    }

    /**
     * Create event exception for delivery failure.
     */
    public static function deliveryFailed(
        string $message = '',
        ?string $eventType = null,
        ?array $data = null,
        ?Throwable $previous = null
    ): void {
        self::throw(
            EventErrorCode::EVENT_DELIVERY_FAILED,
            $message,
            $eventType,
            $data,
            $previous
        );
    }

    /**
     * Create event exception for data validation failure.
     */
    public static function dataValidationFailed(
        string $message = '',
        ?string $eventType = null,
        ?array $data = null,
        ?Throwable $previous = null
    ): void {
        self::throw(
            EventErrorCode::EVENT_DATA_VALIDATION_FAILED,
            $message,
            $eventType,
            $data,
            $previous
        );
    }

    /**
     * Create event exception for retry exceeded.
     */
    public static function retryExceeded(
        string $message = '',
        ?string $eventType = null,
        ?array $data = null,
        ?Throwable $previous = null
    ): void {
        self::throw(
            EventErrorCode::EVENT_CONSUMER_RETRY_EXCEEDED,
            $message,
            $eventType,
            $data,
            $previous
        );
    }

    /**
     * Create event exception for timeout.
     */
    public static function timeout(
        string $message = '',
        ?string $eventType = null,
        ?array $data = null,
        ?Throwable $previous = null
    ): void {
        self::throw(
            EventErrorCode::EVENT_CONSUMER_TIMEOUT,
            $message,
            $eventType,
            $data,
            $previous
        );
    }
}
