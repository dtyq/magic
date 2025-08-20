<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectForkEvent;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use Hyperf\Contract\StdoutLoggerInterface;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;
use Throwable;

/**
 * Project fork message subscriber.
 */
#[Consumer(
    exchange: 'super_magic_project_fork',
    routingKey: 'super_magic_project_fork',
    queue: 'super_magic_project_fork',
    nums: 1
)]
class ProjectForkSubscriber extends ConsumerMessage
{
    /**
     * @var AMQPTable|array Queue parameters for setting priority etc
     */
    protected AMQPTable|array $queueArguments = [];

    /**
     * @var null|array QoS configuration for controlling prefetch count etc
     */
    protected ?array $qos = [
        'prefetch_count' => 1, // Prefetch only 1 message at a time
        'prefetch_size' => 0,
        'global' => false,
    ];

    /**
     * Constructor.
     */
    public function __construct(
        private readonly ProjectAppService $projectAppService,
        protected LockerInterface $locker,
        private readonly StdoutLoggerInterface $logger
    ) {
        // Set queue priority parameters
        $this->queueArguments['x-max-priority'] = ['I', 10]; // Set max priority to 10
    }

    /**
     * Consume message.
     *
     * @param mixed $data Message data
     * @param AMQPMessage $message Original message object
     * @return Result Processing result
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        try {
            // Log received message content
            $this->logger->info(sprintf(
                'Received project fork message: %s',
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));

            // Get message properties and check seconds timestamp
            $messageProperties = $message->get_properties();
            $applicationHeaders = $messageProperties['application_headers'] ?? new AMQPTable([]);
            $originalTimestampFromHeader = $applicationHeaders->getNativeData()['x-original-timestamp'] ?? null;

            $currentTimeForLog = time();
            $actualOriginalTimestamp = null;

            if ($originalTimestampFromHeader !== null) {
                $actualOriginalTimestamp = (int) $originalTimestampFromHeader;
                $this->logger->info(sprintf(
                    'Message has existing original timestamp: %d (%s), event_id: %s',
                    $actualOriginalTimestamp,
                    date('Y-m-d H:i:s', $actualOriginalTimestamp),
                    $data['event_id'] ?? 'N/A'
                ));
            } else {
                $actualOriginalTimestamp = $currentTimeForLog;
                $this->logger->warning(sprintf(
                    'Message did not find x-original-timestamp header, using current time as reference: %d (%s). Event ID: %s',
                    $actualOriginalTimestamp,
                    date('Y-m-d H:i:s', $actualOriginalTimestamp),
                    $data['event_id'] ?? 'N/A'
                ));
            }

            // Validate message format
            $this->validateMessageFormat($data);

            // Create event object
            $event = ProjectForkEvent::fromArray($data);

            // Acquire a lock for this specific fork record to prevent concurrent processing
            $lockKey = 'project_fork_migration_lock:' . $event->getForkRecordId();
            $lockOwner = IdGenerator::getUniqueId32();
            $lockExpireSeconds = 300; // Lock for 5 minutes, assuming migration batch takes less time

            if (! $this->locker->mutexLock($lockKey, $lockOwner, $lockExpireSeconds)) {
                $this->logger->warning(sprintf(
                    'Failed to acquire lock for project fork record ID: %d, event ID: %s. Another consumer is likely processing this fork record. Message will be acknowledged.',
                    $event->getForkRecordId(),
                    $event->getEventId()
                ));
                return Result::ACK; // ACK if lock cannot be acquired to prevent duplicate processing
            }

            $this->logger->info(sprintf(
                'Acquired lock for project fork record ID: %d, lock owner: %s, event ID: %s',
                $event->getForkRecordId(),
                $lockOwner,
                $event->getEventId()
            ));

            try {
                // Process file migration
                $this->processProjectFork($event);
                return Result::ACK;
            } finally {
                if (! $this->locker->release($lockKey, $lockOwner)) {
                    $this->logger->error(sprintf(
                        'Failed to release lock for project fork record ID: %d, event ID: %s. Manual intervention might be needed.',
                        $event->getForkRecordId(),
                        $event->getEventId()
                    ));
                } else {
                    $this->logger->info(sprintf(
                        'Released lock for project fork record ID: %d, lock owner: %s, event ID: %s',
                        $event->getForkRecordId(),
                        $lockOwner,
                        $event->getEventId()
                    ));
                }
            }
        } catch (BusinessException $e) {
            $this->logger->error(sprintf(
                'Failed to process project fork message, business exception: %s, message content: %s',
                $e->getMessage(),
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));
            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to process project fork message, system exception: %s, message content: %s',
                $e->getMessage(),
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));
            return Result::ACK;
        }
    }

    /**
     * Validate message format.
     *
     * @param mixed $data Message data
     * @throws BusinessException If message format is incorrect
     */
    private function validateMessageFormat($data): void
    {
        $requiredFields = [
            'event_id',
            'source_project_id',
            'fork_project_id',
            'user_id',
            'organization_code',
            'fork_record_id',
        ];

        foreach ($requiredFields as $field) {
            if (! isset($data[$field]) || (is_string($data[$field]) && empty($data[$field]))) {
                $this->logger->warning(sprintf(
                    'Project fork message format incorrect, missing required field: %s, message content: %s',
                    $field,
                    json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                ));
                throw new BusinessException("Invalid message format: missing field {$field}");
            }
        }
    }

    /**
     * Process project fork file migration.
     *
     * @param ProjectForkEvent $event Project fork event
     * @throws BusinessException
     */
    private function processProjectFork(ProjectForkEvent $event): void
    {
        $this->logger->info(sprintf(
            'Start processing project fork, source project ID: %d, fork project ID: %d, user: %s, organization: %s, fork record ID: %d',
            $event->getSourceProjectId(),
            $event->getForkProjectId(),
            $event->getUserId(),
            $event->getOrganizationCode(),
            $event->getForkRecordId()
        ));

        try {
            // Call application service to handle file migration
            $this->projectAppService->migrateProjectFile($event);

            $this->logger->info(sprintf(
                'Project fork processing completed successfully, fork record ID: %d, event ID: %s',
                $event->getForkRecordId(),
                $event->getEventId()
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Project fork processing failed, fork record ID: %d, error: %s',
                $event->getForkRecordId(),
                $e->getMessage()
            ));
            throw $e;
        }
    }
}
