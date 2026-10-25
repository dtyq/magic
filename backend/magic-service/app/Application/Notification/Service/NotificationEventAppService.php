<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Service;

use App\Application\Notification\Contract\EventEnvelope;
use App\Application\Notification\Contract\NotificationEventPublisherInterface;
use App\Application\Notification\Event\NotificationEventConsumeRequested;
use App\Application\Notification\Validator\NotificationEventEnvelopeValidator;
use App\Domain\Notification\Constant\NotificationEventStatus;
use App\Domain\Notification\Constant\NotificationEventType;
use App\Domain\Notification\Entity\NotificationEventEntity;
use App\Domain\Notification\Repository\Facade\NotificationEventRepositoryInterface;
use App\ErrorCode\EventErrorCode;
use App\ErrorCode\NotificationErrorCode;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

final readonly class NotificationEventAppService implements NotificationEventPublisherInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private NotificationEventEnvelopeValidator $validator,
        private NotificationEventRepositoryInterface $events,
        private EventDispatcherInterface $dispatcher,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /** @return array{event_id:string,status:string,accepted:bool,duplicate:bool,queued:bool,code:?int} */
    public function publish(array|EventEnvelope $envelope): array
    {
        $data = $this->validator->validate($envelope);
        $eventId = (string) $data['event_id'];
        $existing = $this->events->findByEventId($eventId);
        $duplicate = $existing !== null;

        if ($existing === null) {
            $source = (array) $data['source'];
            $entity = new NotificationEventEntity();
            $entity->setEventId($eventId);
            $entity->setEventType(NotificationEventType::from((string) $data['event_type']));
            $entity->setOrganizationCode((string) $data['organization_code']);
            $entity->setSourceDomain((string) $source['domain']);
            $entity->setSourceType((string) $source['type']);
            $entity->setSourceId((string) $source['id']);
            $entity->setSourceVersion(isset($source['version']) ? (string) $source['version'] : null);
            $entity->setEventPayload($data);
            $entity->setStatus(NotificationEventStatus::PENDING);
            $entity->setRecipientCount(count((array) $data['recipients']));
            $existing = $this->events->createOrGet($entity);
            $duplicate = $existing->getId() !== $entity->getId();
        }

        // A duplicate pending event can be a prior publish whose async dispatch failed.
        // Re-publishing the lightweight trigger is safe because the consumer uses a CAS lease.
        $queued = true;
        $code = null;
        if ($existing->getStatus() === NotificationEventStatus::PENDING) {
            try {
                $this->dispatcher->dispatch(new NotificationEventConsumeRequested($eventId));
            } catch (Throwable $throwable) {
                $queued = false;
                $code = NotificationErrorCode::EVENT_DISPATCH_FAILED->value;
                $this->events->markDispatchFailed(
                    $eventId,
                    NotificationErrorFormatter::code($throwable, EventErrorCode::EVENT_DELIVERY_FAILED->value),
                    NotificationErrorFormatter::message($throwable),
                    date('Y-m-d H:i:s'),
                );
                $this->logger->error('Notification event dispatch failed', [
                    'event_id' => $eventId,
                    'error_code' => NotificationErrorFormatter::code($throwable, EventErrorCode::EVENT_DELIVERY_FAILED->value),
                    'error' => $throwable->getMessage(),
                    'trace' => $throwable->getTraceAsString(),
                ]);
            }
        }

        return [
            'event_id' => $eventId,
            'status' => $existing->getStatus()->value,
            'accepted' => true,
            'duplicate' => $duplicate,
            'queued' => $queued,
            'code' => $code,
        ];
    }
}
