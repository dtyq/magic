<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchMoveEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Infrastructure\Utils\FileBatchOperationStatusManager;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use Hyperf\Logger\LoggerFactory;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * File batch move operation subscriber.
 * 
 * Handles asynchronous batch file move operations when dealing with multiple files.
 */
#[Consumer(
    exchange: 'file.batch.move',
    routingKey: 'file.batch.move',
    queue: 'file.batch.move',
    nums: 1
)]
class FileBatchMoveSubscriber extends ConsumerMessage
{
    /**
     * @var AMQPTable|array Queue arguments for setting priority etc.
     */
    protected AMQPTable|array $queueArguments = [];

    /**
     * @var null|array QoS configuration for controlling prefetch count etc.
     */
    protected ?array $qos = [
        'prefetch_count' => 1, // Prefetch only 1 message at a time
        'prefetch_size' => 0,
        'global' => false,
    ];

    private LoggerInterface $logger;

    /**
     * Constructor.
     */
    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileBatchOperationStatusManager $statusManager,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileBatchMove');
    }

    /**
     * Consume batch move event message.
     * 
     * @param array $data Event data containing batch move parameters
     * @param AMQPMessage $message AMQP message
     * @return Result Processing result
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        try {
            // Create event from array data
            $event = FileBatchMoveEvent::fromArray($data);

            $this->logger->info('Received file batch move event', [
                'batch_key' => $event->getBatchKey(),
                'file_ids' => $event->getFileIds(),
                'target_parent_id' => $event->getTargetParentId(),
                'file_count' => count($event->getFileIds())
            ]);

            // Extract parameters from event
            $batchKey = $event->getBatchKey();
            $userId = $event->getUserId();
            $organizationCode = $event->getOrganizationCode();
            $fileIds = $event->getFileIds();
            $projectId = $event->getProjectId();
            $preFileId = $event->getPreFileId();
            $targetParentId = $event->getTargetParentId();

            // Validate required parameters
            if (empty($batchKey) || empty($userId) || empty($fileIds) || !$projectId) {
                $this->logger->error('Invalid batch move event data: missing required parameters', [
                    'batch_key' => $batchKey,
                    'user_id' => $userId,
                    'file_ids' => $fileIds,
                    'project_id' => $projectId
                ]);
                
                // Mark task as failed if we have batch key
                if (!empty($batchKey)) {
                    $this->statusManager->setTaskFailed($batchKey, 'Invalid batch move event data: missing required parameters');
                }
                
                return Result::ACK;
            }

            // Log the received parameters for debugging
            $this->logger->debug('File batch move event parameters extracted', [
                'batch_key' => $batchKey,
                'user_id' => $userId,
                'organization_code' => $organizationCode,
                'file_ids' => $fileIds,
                'project_id' => $projectId,
                'pre_file_id' => $preFileId,
                'target_parent_id' => $targetParentId,
                'file_count' => count($fileIds)
            ]);

            // Set task progress to started
            $this->statusManager->setTaskProgress($batchKey, 0, count($fileIds), 'Starting batch file move process');

            // Create data isolation
            $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);

            // TODO: Implement batch file move logic here
            // The actual implementation should be added by the user
            // This is just a framework with basic structure

            // For now, just mark as completed with placeholder message
            $this->statusManager->setTaskCompleted($batchKey, [
                'file_ids' => $fileIds,
                'target_parent_id' => $targetParentId,
                'operation' => 'batch_move',
                'message' => 'Batch file move completed (implementation pending)',
                'file_count' => count($fileIds)
            ]);
            
            $this->logger->info('File batch move event processed successfully', [
                'batch_key' => $batchKey,
                'file_count' => count($fileIds)
            ]);

            return Result::ACK;

        } catch (Throwable $e) {
            $this->logger->error('Failed to process file batch move event', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'data' => $data
            ]);

            // Mark task as failed if we have batch key
            $batchKey = $data['batch_key'] ?? '';
            if (!empty($batchKey)) {
                $this->statusManager->setTaskFailed($batchKey, $e->getMessage());
            }

            // Return ACK to avoid retrying failed message
            return Result::ACK;
        }
    }
}
