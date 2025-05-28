<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception\Examples;

use App\Infrastructure\Core\Exception\EventExceptionBuilder;
use Exception;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use PhpAmqpLib\Message\AMQPMessage;
use Throwable;

/**
 * Simplified example usage of EventException in event consumers
 * This file demonstrates how to properly use the simplified EventException.
 */
class EventExceptionUsageExample extends ConsumerMessage
{
    protected string $exchange = 'example.exchange';

    protected array|string $routingKey = 'example.routing.key';

    protected ?string $queue = 'example.queue';

    /**
     * Example of how to use simplified EventException in a consumer.
     * @param mixed $data
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        $eventType = 'ExampleEvent';
        $eventData = $data;

        try {
            // Validate event data
            $this->validateEventData($data);

            // Process the event
            $this->processEvent($data);

            return Result::ACK;
        } catch (Throwable $exception) {
            // Example 1: Using EventExceptionBuilder for consumer execution failure
            EventExceptionBuilder::consumerExecutionFailed(
                message: 'Failed to process example event',
                eventType: $eventType,
                data: $eventData,
                previous: $exception
            );
        }

        // This line should never be reached due to the exception throw above
        return Result::NACK;
    }

    /**
     * Example of data validation with simplified EventException.
     */
    private function validateEventData(array $data): void
    {
        if (empty($data['required_field'])) {
            // Example 2: Using EventExceptionBuilder for data validation failure
            EventExceptionBuilder::dataValidationFailed(
                message: 'Required field is missing',
                eventType: 'ExampleEvent',
                data: $data
            );
        }
    }

    /**
     * Example of event processing with timeout handling.
     */
    private function processEvent(array $data): void
    {
        try {
            // Simulate some processing that might timeout
            $this->performLongRunningTask($data);
        } catch (Exception $exception) {
            if ($this->isTimeoutException($exception)) {
                // Example 3: Using EventExceptionBuilder for timeout
                EventExceptionBuilder::timeout(
                    message: 'Event processing timed out',
                    eventType: 'ExampleEvent',
                    data: $data,
                    previous: $exception
                );
            }

            throw $exception;
        }
    }

    // Mock methods for demonstration
    private function performLongRunningTask(array $data): void
    {
        // Simulate processing
    }

    private function isTimeoutException(Exception $exception): bool
    {
        return str_contains($exception->getMessage(), 'timeout');
    }
}
