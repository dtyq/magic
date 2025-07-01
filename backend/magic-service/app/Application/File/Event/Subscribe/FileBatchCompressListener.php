<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\File\Event\Subscribe;

use App\Application\File\Service\FileBatchCompressAppService;
use App\Domain\File\Event\FileBatchCompressEvent;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Log\LoggerInterface;
use Throwable;

#[Consumer(
    exchange: 'file.batch.compress',
    routingKey: 'file.batch.compress',
    queue: 'file.batch.compress',
    nums: 2
)]
class FileBatchCompressListener extends ConsumerMessage
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly FileBatchCompressAppService $fileBatchCompressAppService,
    ) {
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get('FileBatchCompress');
    }

    /**
     * @param array $data
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        try {
            $this->logger->info('Received file batch compress event', [
                'source' => $data['source'] ?? '',
                'organization_code' => $data['organization_code'] ?? '',
                'user_id' => $data['user_id'] ?? '',
                'cache_key' => $data['cache_key'] ?? '',
            ]);

            // Validate required fields
            if (empty($data['cache_key']) || empty($data['organization_code']) || empty($data['files'])) {
                $this->logger->error('Missing required fields in batch compress event', $data);
                return Result::ACK; // ACK to avoid redelivery for invalid data
            }

            // Create FileBatchCompressEvent object from array data
            $event = FileBatchCompressEvent::fromArray($data);

            // Delegate to application service for processing
            $result = $this->fileBatchCompressAppService->processBatchCompressFromEvent($event);

            if ($result['success']) {
                $this->logger->info('File batch compress completed successfully', [
                    'cache_key' => $event->getCacheKey(),
                    'file_count' => $result['file_count'] ?? 0,
                    'zip_size_mb' => isset($result['zip_size']) ? round($result['zip_size'] / 1024 / 1024, 2) : 0,
                ]);
            } else {
                $this->logger->error('File batch compress failed', [
                    'cache_key' => $event->getCacheKey(),
                    'error' => $result['error'] ?? 'Unknown error',
                ]);
            }

            return Result::ACK;
        } catch (Throwable $exception) {
            $this->logger->error('Error processing file batch compress', [
                'error' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => $exception->getTraceAsString(),
                'data' => $data,
            ]);

            // Return REQUEUE for retryable errors, ACK for permanent failures
            return Result::REQUEUE;
        }
    }
}
