<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\DirectoryMoveEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
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
 * Handles asynchronous file/directory move operations when dealing with large amounts of data.
 */
#[Consumer(
    exchange: 'file.directory.move',
    routingKey: 'file.directory.move',
    queue: 'file.directory.move',
    nums: 1
)]
class DirectoryMoveSubscriber extends ConsumerMessage
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
     * Consume move event message.
     * 
     * @param array $data Event data containing move parameters
     * @param AMQPMessage $message AMQP message
     * @return Result Processing result
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        try {
            // Create event from array data
            $event = DirectoryMoveEvent::fromArray($data);

            $this->logger->info('Received file batch move event', [
                'batch_key' => $event->getBatchKey(),
                'file_id' => $event->getFileId(),
                'target_parent_id' => $event->getTargetParentId()
            ]);

            // Extract parameters from event
            $batchKey = $event->getBatchKey();
            $userId = $event->getUserId();
            $organizationCode = $event->getOrganizationCode();
            $fileId = $event->getFileId();
            $projectId = $event->getProjectId();
            $preFileId = $event->getPreFileId();
            $targetParentId = $event->getTargetParentId();

            // Validate required parameters
            if (empty($batchKey) || empty($userId) || !$fileId || !$projectId) {
                $this->logger->error('Invalid move event data: missing required parameters', [
                    'batch_key' => $batchKey,
                    'user_id' => $userId,
                    'file_id' => $fileId,
                    'project_id' => $projectId
                ]);
                
                // Mark task as failed if we have batch key
                if (!empty($batchKey)) {
                    $this->statusManager->setTaskFailed($batchKey, 'Invalid move event data: missing required parameters');
                }
                
                return Result::ACK;
            }

            // Log the received parameters for debugging
            $this->logger->debug('File move event parameters extracted', [
                'batch_key' => $batchKey,
                'user_id' => $userId,
                'organization_code' => $organizationCode,
                'file_id' => $fileId,
                'project_id' => $projectId,
                'pre_file_id' => $preFileId,
                'target_parent_id' => $targetParentId
            ]);

            // Set task progress to started
            $this->statusManager->setTaskProgress($batchKey, 0, 1, 'Starting file move process');

            $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);
            $fileEntity = $this->taskFileDomainService->getById($fileId);
            $projectEntity = $this->projectDomainService->getProject($projectId, $userId);

            // single file sync move
            // 3. Handle cross-directory move file path update (check BEFORE modifying parent_id)
            $originalParentId = $fileEntity->getParentId();
            if ($originalParentId !== $targetParentId) {
                $this->taskFileDomainService->moveProjectFile(
                    $dataIsolation,
                    $fileEntity,
                    $projectEntity->getWorkDir(),
                    $targetParentId
                );
            }

            // 4. Use enhanced sorting method to handle move (includes locking and re balancing)
            $this->taskFileDomainService->handleFileSortOnMove(
                $fileEntity,
                $targetParentId,
                $preFileId
            );

            // Mark task as completed successfully
            $this->statusManager->setTaskCompleted($batchKey, [
                'file_id' => $fileId,
                'original_parent_id' => $originalParentId,
                'target_parent_id' => $targetParentId,
                'operation' => 'move',
                'message' => 'File moved successfully'
            ]);
            
            $this->logger->info('File batch move event processed successfully', [
                'batch_key' => $batchKey,
                'file_id' => $fileId
            ]);

            return Result::ACK;

        } catch (Throwable $e) {
            $this->logger->error('Failed to process file batch move event', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'data' => $data
            ]);

            // Mark task as failed if we have batch key
            if (!empty($batchKey)) {
                $this->statusManager->setTaskFailed($batchKey, $e->getMessage());
            }

            // Return ACK to avoid retrying failed message
            return Result::ACK;
        }
    }
}
