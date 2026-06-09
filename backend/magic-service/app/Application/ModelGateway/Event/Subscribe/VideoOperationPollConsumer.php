<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event\Subscribe;

use App\Application\ModelGateway\Event\Message\VideoOperationPollMessage;
use App\Application\ModelGateway\Event\Publish\VideoOperationPollDelayPublisher;
use App\Application\ModelGateway\Service\VideoOperationAppService;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Producer;
use Hyperf\Amqp\Result;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Log\LoggerInterface;
use Throwable;

#[Consumer(
    exchange: 'model_gateway.videos.poll',
    routingKey: 'model_gateway.videos.poll',
    queue: 'model_gateway.videos.poll',
    nums: 1
)]
class VideoOperationPollConsumer extends ConsumerMessage
{
    public function __construct(
        private readonly VideoOperationAppService $videoOperationAppService,
        private readonly Producer $producer,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function consumeMessage($data, AMQPMessage $message): Result
    {
        $msg = VideoOperationPollMessage::fromArray((array) $data);
        if ($msg->operationId === '') {
            return Result::ACK;
        }

        $maxAttempts = max(1, (int) config('model_gateway.video_queue.poll_max_times', 360));

        try {
            $isDone = $this->videoOperationAppService->pollOperationById($msg->operationId, $msg->businessParams);
        } catch (Throwable $throwable) {
            $this->logger->warning('video operation poll failed', [
                'operation_id' => $msg->operationId,
                'attempt' => $msg->attempt,
                'max_attempts' => $maxAttempts,
                'error' => $throwable->getMessage(),
            ]);

            if ($msg->attempt + 1 >= $maxAttempts) {
                $this->videoOperationAppService->timeoutOperationById($msg->operationId, $msg->businessParams);
                return Result::ACK;
            }

            $this->producer->produce(new VideoOperationPollDelayPublisher($msg->nextAttempt()));
            return Result::ACK;
        }

        if ($isDone) {
            return Result::ACK;
        }

        if ($msg->attempt + 1 >= $maxAttempts) {
            $this->videoOperationAppService->timeoutOperationById($msg->operationId, $msg->businessParams);
            return Result::ACK;
        }

        $this->producer->produce(new VideoOperationPollDelayPublisher($msg->nextAttempt()));
        return Result::ACK;
    }
}
