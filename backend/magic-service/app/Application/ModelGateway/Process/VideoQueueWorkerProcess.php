<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Process;

use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Service\QueueCoreDomainService;
use App\Domain\ModelGateway\Service\QueueOperationExecutionDomainService;
use App\Domain\ModelGateway\Service\VideoQueueDomainService;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Process\AbstractProcess;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class VideoQueueWorkerProcess extends AbstractProcess
{
    private LoggerInterface $logger;

    public function __construct(
        ContainerInterface $container,
        private readonly QueueCoreDomainService $queueCoreDomainService,
        private readonly VideoQueueDomainService $videoQueueDomainService,
        private readonly QueueOperationExecutionDomainService $queueOperationExecutionDomainService,
        LoggerFactory $loggerFactory,
    ) {
        parent::__construct($container);
        $this->logger = $loggerFactory->get('VideoQueueWorkerProcess');
    }

    public function handle(): void
    {
        while ($this->shouldContinueWorkerLoop()) {
            $endpoint = $this->queueCoreDomainService->blockPopSignal(5);
            if ($endpoint === null) {
                continue;
            }

            foreach ($this->queueCoreDomainService->dispatchEndpoint(
                $endpoint,
                $this->videoQueueDomainService->maxConcurrency(),
                $this->videoQueueDomainService->operationTtlSeconds(),
                $this->videoQueueDomainService->lockExpireSeconds(),
            ) as $operation) {
                Coroutine::create(function () use ($operation) {
                    $this->processOperation($operation);
                });
            }
        }
    }

    protected function shouldContinueWorkerLoop(): bool
    {
        return true;
    }

    private function processOperation(VideoQueueOperationEntity $operation): void
    {
        try {
            $config = $this->queueOperationExecutionDomainService->getConfig($operation);
            $providerTaskId = $this->queueOperationExecutionDomainService->submit($operation, $config);
            $this->queueCoreDomainService->markProviderRunning(
                $operation,
                $providerTaskId,
                $this->videoQueueDomainService->operationTtlSeconds(),
            );

            for ($index = 0; $index < $config->getMaxPollTimes(); ++$index) {
                $result = $this->queueOperationExecutionDomainService->query($operation, $config, $providerTaskId);
                $syncResult = $this->videoQueueDomainService->syncWithExecutionResult($operation, $providerTaskId, $result);
                if ($syncResult->getStatus()->isDone()) {
                    $this->queueCoreDomainService->finish(
                        $operation,
                        $this->videoQueueDomainService->operationTtlSeconds(),
                        $this->videoQueueDomainService->lockExpireSeconds(),
                    );
                    return;
                }

                $this->queueCoreDomainService->touchHeartbeat(
                    $operation,
                    $this->videoQueueDomainService->operationTtlSeconds(),
                );
                Coroutine::sleep((float) $config->getPollIntervalSeconds());
            }

            $this->videoQueueDomainService->finishProviderTimeout($operation);
            $this->queueCoreDomainService->finish(
                $operation,
                $this->videoQueueDomainService->operationTtlSeconds(),
                $this->videoQueueDomainService->lockExpireSeconds(),
            );
        } catch (Throwable $throwable) {
            $this->handleExecutionFailure($operation, $throwable);
            $this->logger->error('video operation failed', [
                'operation_id' => $operation->getId(),
                'endpoint' => $operation->getEndpoint(),
                'user_id' => $operation->getUserId(),
                'error' => $throwable->getMessage(),
            ]);
        }
    }

    private function handleExecutionFailure(VideoQueueOperationEntity $operation, Throwable $throwable): void
    {
        try {
            $this->videoQueueDomainService->finishExecutionFailure($operation, $throwable->getMessage());
            $this->queueCoreDomainService->finish(
                $operation,
                $this->videoQueueDomainService->operationTtlSeconds(),
                $this->videoQueueDomainService->lockExpireSeconds(),
            );
        } catch (Throwable $finishThrowable) {
            $this->logger->error('video operation finish failed', [
                'operation_id' => $operation->getId(),
                'endpoint' => $operation->getEndpoint(),
                'user_id' => $operation->getUserId(),
                'error' => $finishThrowable->getMessage(),
            ]);
        }
    }
}
