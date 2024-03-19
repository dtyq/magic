<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Infrastructure\Core\Traits\HasLogger;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AccountAppService;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use PhpAmqpLib\Message\AMQPMessage;
use Throwable;

#[Consumer(exchange: 'organization_created_message', routingKey: 'organization_created_message', queue: 'organization_created_message', nums: 1)]
class InitAccountMessageSubscriber extends ConsumerMessage
{
    use HasLogger;

    public function __construct(
        private readonly AccountAppService $accountAppService,
    ) {
    }

    public function consumeMessage($event, AMQPMessage $message): Result
    {
        try {
            // 提取必要信息
            $organizationCode = $event['organization_code'] ?? '';
            $this->logger->debug(sprintf(
                '接收到组织创建消息，organization_code=%s, event_keys=%s',
                $organizationCode,
                implode(',', array_keys((array) $event))
            ));

            // 参数验证
            if (empty($organizationCode)) {
                $this->logger->error(sprintf(
                    '消息参数不完整, $organizationCode: %s',
                    $organizationCode,
                ));
                return Result::ACK;
            }
            $this->accountAppService->initAccount($organizationCode);
            $this->logger->info(sprintf('超级麦吉账户已初始化，组织code: %s', $organizationCode));

            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '处理超级麦吉账户消息失败: %s, organization_code=%s',
                $e->getMessage(),
                $event['organization_code'] ?? ''
            ));

            return Result::ACK; // 即使出错也确认消息，避免消息堆积
        }
    }
}
