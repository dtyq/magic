<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Event\Subscribe;

use App\Application\Design\Event\Message\DesignVideoPollMessage;
use App\Application\Design\Event\Message\DesignVideoSubmitMessage;
use App\Application\Design\Event\Publish\DesignVideoPollDelayPublisher;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\Design\Service\DesignVideoSubmissionDomainService;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Producer;
use Hyperf\Amqp\Result;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 在后台提交需要较长初始化时间的 Design 视频任务。
 */
#[Consumer(
    exchange: 'design.videos.submit',
    routingKey: 'design.videos.submit',
    queue: 'design.videos.submit',
    nums: 1
)]
class DesignVideoSubmitConsumer extends ConsumerMessage
{
    public function __construct(
        private readonly DesignGenerationTaskDomainService $domainService,
        private readonly DesignVideoSubmissionDomainService $submissionDomainService,
        private readonly Producer $producer,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * 提交画布合成任务，保存执行快照后投递首次轮询消息。
     * @param mixed $data
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        $msg = DesignVideoSubmitMessage::fromArray((array) $data);
        if ($msg->organizationCode === '' || $msg->projectId <= 0 || $msg->generationId === '') {
            return Result::ACK;
        }

        $dataIsolation = DesignDataIsolation::create($msg->organizationCode);
        $entity = $this->domainService->findVideoTask($dataIsolation, $msg->projectId, $msg->generationId);
        if ($entity === null || $entity->isFinal() || $entity->hasOperationId()) {
            return Result::ACK;
        }

        $dataIsolation = DesignDataIsolation::create($msg->organizationCode, $entity->getUserId());
        if (! $entity->isCanvasComposition()) {
            $this->logger->error('design video async submit ignored', [
                'reason' => 'unsupported_generation_type',
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
            ]);
            return Result::ACK;
        }

        try {
            $contactIsolation = ContactDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
            $contactIsolation->initDataIsolationEnv();
            $providerPayload = $this->submissionDomainService->submitCanvasComposition($entity, $contactIsolation);
            $this->domainService->markAsSubmitted($dataIsolation, $entity, $providerPayload);
            $this->logger->info('design video async submit succeeded', [
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'sandbox_id' => (string) ($providerPayload['sandbox_id'] ?? ''),
                'operation_id' => (string) ($providerPayload['operation_id'] ?? ''),
                'submit_endpoint' => (string) ($providerPayload['submit_endpoint'] ?? ''),
            ]);
        } catch (Throwable $throwable) {
            $this->logger->error('design video async submit failed', [
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'sandbox_id' => (string) ($entity->getProviderPayload()['sandbox_id'] ?? ''),
                'error' => $throwable->getMessage(),
            ]);
            $this->domainService->markAsFailed($dataIsolation, $entity, $throwable->getMessage());
            return Result::ACK;
        }

        try {
            $this->producer->produce(new DesignVideoPollDelayPublisher(new DesignVideoPollMessage(
                $entity->getOrganizationCode(),
                $entity->getProjectId(),
                $entity->getGenerationId(),
            )));
            $this->domainService->markFirstPollSent($dataIsolation, $entity);
        } catch (Throwable $throwable) {
            $this->logger->error('design video first poll dispatch failed after async submit', [
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'error' => $throwable->getMessage(),
            ]);
            $this->domainService->markFirstPollDispatchFailed(
                $dataIsolation,
                $entity,
                $throwable->getMessage(),
                date(DATE_ATOM, time() + 60),
            );
        }

        return Result::ACK;
    }
}
