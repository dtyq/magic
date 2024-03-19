<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Chat\Service\MagicControlMessageAppService;
use App\Application\Chat\Service\MagicSeqAppService;
use App\Domain\Chat\Entity\ValueObject\AmqpTopicType;
use App\Domain\Chat\Entity\ValueObject\MessagePriority;
use App\Domain\Chat\Repository\Facade\MagicChatSeqRepositoryInterface;
use App\Domain\Chat\Service\MagicSeqDomainService;
use App\Domain\Contact\Repository\Persistence\MagicUserRepository;
use App\Infrastructure\Core\Traits\ChatAmqpTrait;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Amqp\Builder\QueueBuilder;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use PhpAmqpLib\Wire\AMQPTable;
use Psr\Log\LoggerInterface;
use RedisException;

abstract class AbstractSeqConsumer extends ConsumerMessage
{
    use ChatAmqpTrait;

    // 子类需要指明 topic 类型
    protected AmqpTopicType $topic;

    protected LoggerInterface $logger;

    /**
     * 设置队列优先级参数.
     */
    protected AMQPTable|array $arguments = [
        'x-ha-policy' => ['S', 'all'], // 将队列镜像到所有节点,hyperf 默认配置
    ];

    protected MessagePriority $priority;

    public function __construct(
        protected Redis $redis,
        protected MagicSeqAppService $magicSeqAppService,
        protected MagicChatSeqRepositoryInterface $magicChatSeqRepository,
        protected MagicChatMessageAppService $magicChatMessageAppService,
        protected MagicControlMessageAppService $magicControlMessageAppService,
        protected MagicSeqDomainService $magicSeqDomainService,
        protected MagicUserRepository $magicUserRepository,
    ) {
        // 设置列队优先级
        $this->arguments['x-max-priority'] = ['I', $this->priority->value];
        $this->exchange = $this->getExchangeName($this->topic);
        $this->routingKey = $this->getRoutingKeyName($this->topic, $this->priority);
        $this->queue = sprintf('%s.%s.queue', $this->exchange, $this->priority->name);
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(get_class($this));
    }

    /**
     * 继承以实现设置队列相关参数.
     */
    public function getQueueBuilder(): QueueBuilder
    {
        return (new QueueBuilder())->setQueue($this->getQueue())->setArguments($this->arguments);
    }

    protected function setSeqCanNotRetry(string $retryCacheKey)
    {
        // 不再重推
        try {
            $this->redis->set($retryCacheKey, 3);
            $this->redis->expire($retryCacheKey, 3600);
        } catch (RedisException) {
        }
    }

    protected function addSeqRetryNumber(string $retryCacheKey)
    {
        // 不再重推
        try {
            $this->redis->incr($retryCacheKey);
            $this->redis->expire($retryCacheKey, 3600);
        } catch (RedisException) {
        }
    }

    protected function setRequestId(string $appMsgId): void
    {
        // 使用 app_msg_id 做 request_id
        $requestId = empty($appMsgId) ? IdGenerator::getSnowId() : $appMsgId;
        CoContext::setRequestId((string) $requestId);
    }
}
