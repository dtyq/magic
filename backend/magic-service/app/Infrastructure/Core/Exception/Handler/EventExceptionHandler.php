<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception\Handler;

use App\Infrastructure\Core\Exception\EventException;
use Hyperf\Codec\Json;
use Hyperf\HttpMessage\Stream\SwooleStream;
use Psr\Http\Message\ResponseInterface;
use stdClass;
use Throwable;

/**
 * Event exception handler for handling event-related errors
 * Provides detailed logging and response formatting for event exceptions.
 */
class EventExceptionHandler extends AbstractExceptionHandler
{
    public function handle(Throwable $throwable, ResponseInterface $response): ResponseInterface
    {
        $this->stopPropagation();

        /** @var EventException $throwable */
        $data = Json::encode([
            'code' => $throwable->getCode() ?: 6000,
            'message' => $throwable->getMessage(),
            'data' => new stdClass(),
            'error' => [],
        ]);

        // Log detailed event exception information
        $this->logEventException($throwable);

        return $response->withStatus(200)
            ->withHeader('Content-Type', 'application/json')
            ->withBody(new SwooleStream($data));
    }

    public function isValid(Throwable $throwable): bool
    {
        return $throwable instanceof EventException;
    }

    /**
     * Log simplified event exception information.
     */
    private function logEventException(EventException $exception): void
    {
        $context = $exception->getErrorContext();

        $this->logger->error(sprintf(
            PHP_EOL . __CLASS__
            . PHP_EOL . 'Event Exception Details:'
            . PHP_EOL . 'Event Type: %s'
            . PHP_EOL . 'Code: %s'
            . PHP_EOL . 'Message: %s'
            . PHP_EOL . 'Data: %s'
            . PHP_EOL . 'File: %s, Line: %s'
            . PHP_EOL . 'Trace: %s',
            $context['event_type'] ?? 'unknown',
            $context['code'],
            $context['message'],
            Json::encode($context['data'] ?? []),
            $exception->getFile(),
            $exception->getLine(),
            $exception->getTraceAsString()
        ));

        // Log previous exception if exists
        if ($exception->getPrevious()) {
            $previous = $exception->getPrevious();
            $this->logger->error(sprintf(
                PHP_EOL . __CLASS__ . ' - Previous Exception:'
                . PHP_EOL . 'Message: %s'
                . PHP_EOL . 'Code: %s'
                . PHP_EOL . 'Class: %s'
                . PHP_EOL . 'File: %s, Line: %s'
                . PHP_EOL . 'Trace: %s',
                $previous->getMessage(),
                $previous->getCode(),
                get_class($previous),
                $previous->getFile(),
                $previous->getLine(),
                $previous->getTraceAsString()
            ));
        }
    }
}
