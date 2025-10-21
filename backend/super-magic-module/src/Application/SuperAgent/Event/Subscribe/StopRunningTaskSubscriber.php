<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DeleteDataType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\StopRunningTaskEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TopicModel;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use Hyperf\Contract\StdoutLoggerInterface;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;
use Throwable;

/**
 * 停止运行中任务消息订阅者.
 */
#[Consumer(
    exchange: 'super_magic_stop_task',
    routingKey: 'super_magic_stop_task',
    queue: 'super_magic_stop_task',
    nums: 1
)]
class StopRunningTaskSubscriber extends ConsumerMessage
{
    /**
     * @var AMQPTable|array 队列参数，用于设置优先级等
     */
    protected AMQPTable|array $queueArguments = [];

    /**
     * @var null|array QoS 配置，用于控制预取数量等
     */
    protected ?array $qos = [
        'prefetch_count' => 1, // 每次只预取1条消息
        'prefetch_size' => 0,
        'global' => false,
    ];

    /**
     * 构造函数.
     */
    public function __construct(
        private readonly TaskRepositoryInterface $taskRepository,
        private readonly AgentAppService $agentAppService,
        protected LockerInterface $locker,
        private readonly StdoutLoggerInterface $logger
    ) {
        // 设置队列优先级参数
        $this->queueArguments['x-max-priority'] = ['I', 10]; // 设置最高优先级为10
    }

    /**
     * 消费消息.
     *
     * @param mixed $data 消息数据
     * @param AMQPMessage $message 原始消息对象
     * @return Result 处理结果
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        try {
            // 记录接收到的消息内容
            $this->logger->info(sprintf(
                '接收到停止任务消息: %s',
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));

            // 获取消息属性并检查秒级时间戳
            $messageProperties = $message->get_properties();
            $applicationHeaders = $messageProperties['application_headers'] ?? new AMQPTable([]);
            $originalTimestampFromHeader = $applicationHeaders->getNativeData()['x-original-timestamp'] ?? null;

            $currentTimeForLog = time();
            $actualOriginalTimestamp = null;

            if ($originalTimestampFromHeader !== null) {
                $actualOriginalTimestamp = (int) $originalTimestampFromHeader;
                $this->logger->info(sprintf(
                    '消息已存在原始秒级时间戳: %d (%s), event_id: %s',
                    $actualOriginalTimestamp,
                    date('Y-m-d H:i:s', $actualOriginalTimestamp),
                    $data['event_id'] ?? 'N/A'
                ));
            } else {
                $actualOriginalTimestamp = $currentTimeForLog;
                $this->logger->warning(sprintf(
                    '消息未找到 x-original-timestamp 头部，将使用当前时间作为本次处理的原始时间戳参考: %d (%s). Event ID: %s',
                    $actualOriginalTimestamp,
                    date('Y-m-d H:i:s', $actualOriginalTimestamp),
                    $data['event_id'] ?? 'N/A'
                ));
            }

            // 验证消息格式
            $this->validateMessageFormat($data);

            // 创建事件对象
            $event = StopRunningTaskEvent::fromArray($data);

            // 直接处理停止任务，锁的粒度在话题级别处理
            $this->stopRunningTasks($event);
            return Result::ACK;
        } catch (BusinessException $e) {
            $this->logger->error(sprintf(
                '处理停止任务消息失败，业务异常: %s, 消息内容: %s',
                $e->getMessage(),
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));
            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '处理停止任务消息失败，系统异常: %s, 消息内容: %s',
                $e->getMessage(),
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));
            return Result::ACK;
        }
    }

    public function acquireLock(string $lockKey, string $lockOwner, int $lockExpireSeconds): bool
    {
        return $this->locker->mutexLock($lockKey, $lockOwner, $lockExpireSeconds);
    }

    /**
     * 验证消息格式.
     *
     * @param mixed $data 消息数据
     * @throws BusinessException 如果消息格式不正确则抛出异常
     */
    private function validateMessageFormat($data): void
    {
        $requiredFields = [
            'event_id',
            'data_type',
            'data_id',
            'user_id',
            'organization_code',
        ];

        foreach ($requiredFields as $field) {
            if (! isset($data[$field]) || (is_string($data[$field]) && empty($data[$field]))) {
                $this->logger->warning(sprintf(
                    '停止任务消息格式不正确，缺少必要字段: %s, 消息内容: %s',
                    $field,
                    json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                ));
                throw new BusinessException("Invalid message format: missing field {$field}");
            }
        }
    }

    private function releaseLock(string $lockKey, string $lockOwner): bool
    {
        return $this->locker->release($lockKey, $lockOwner);
    }

    /**
     * 停止运行中的任务.
     *
     * @param StopRunningTaskEvent $event 停止任务事件
     * @throws BusinessException|SandboxOperationException
     */
    private function stopRunningTasks(StopRunningTaskEvent $event): void
    {
        $this->logger->info(sprintf(
            '开始处理停止任务请求，类型: %s, ID: %d, 用户: %s, 组织: %s',
            $event->getDataType()->value,
            $event->getDataId(),
            $event->getUserId(),
            $event->getOrganizationCode()
        ));

        try {
            // 根据数据类型查询相关的运行中任务
            $runningTasks = $this->queryRunningTasksByDataType($event);

            if (empty($runningTasks)) {
                $this->logger->info(sprintf(
                    '未找到需要停止的运行中任务，类型: %s, ID: %d',
                    $event->getDataType()->value,
                    $event->getDataId()
                ));
                return;
            }

            $this->logger->info(sprintf(
                '找到 %d 个需要停止的运行中任务，类型: %s, ID: %d',
                count($runningTasks),
                $event->getDataType()->value,
                $event->getDataId()
            ));

            // 按话题ID分组任务
            $tasksByTopic = [];
            foreach ($runningTasks as $task) {
                $topicId = $task->getTopicId();
                if (! isset($tasksByTopic[$topicId])) {
                    $tasksByTopic[$topicId] = [];
                }
                $tasksByTopic[$topicId][] = $task;
            }

            // 创建数据隔离对象
            $dataIsolation = new DataIsolation();
            $dataIsolation->setCurrentUserId($event->getUserId());
            $dataIsolation->setCurrentOrganizationCode($event->getOrganizationCode());

            // 按话题处理任务，为每个话题加锁
            $totalSuccessCount = 0;
            $totalFailureCount = 0;
            $skippedTopicCount = 0;

            foreach ($tasksByTopic as $topicId => $tasks) {
                // 为当前话题获取锁
                $lockKey = 'stop_running_tasks_topic_lock:' . $topicId;
                $lockOwner = IdGenerator::getUniqueId32();
                $lockExpireSeconds = 30; // 话题级别锁，设置30秒超时

                $lockAcquired = $this->acquireLock($lockKey, $lockOwner, $lockExpireSeconds);

                if (! $lockAcquired) {
                    $this->logger->info(sprintf(
                        '无法获取话题 %d 的停止任务锁，跳过该话题的 %d 个任务处理，event_id: %s',
                        $topicId,
                        count($tasks),
                        $event->getEventId()
                    ));
                    ++$skippedTopicCount;
                    continue;
                }

                $this->logger->info(sprintf(
                    '已获取话题 %d 的停止任务锁，开始处理 %d 个任务，event_id: %s',
                    $topicId,
                    count($tasks),
                    $event->getEventId()
                ));

                try {
                    $successCount = 0;
                    $failureCount = 0;

                    foreach ($tasks as $task) {
                        try {
                            $this->agentAppService->sendInterruptMessage(
                                $dataIsolation,
                                $task->getSandboxId(),
                                $task->getTaskId(),
                                $event->getReason()
                            );

                            $this->logger->info(sprintf(
                                '成功发送中断消息，话题ID: %d, 任务ID: %s, 沙箱ID: %s',
                                $topicId,
                                $task->getTaskId(),
                                $task->getSandboxId()
                            ));

                            ++$successCount;
                        } catch (SandboxOperationException $e) {
                            $this->logger->error(sprintf(
                                '发送中断消息失败，话题ID: %d, 任务ID: %s, 沙箱ID: %s, 错误: %s',
                                $topicId,
                                $task->getTaskId(),
                                $task->getSandboxId(),
                                $e->getMessage()
                            ));
                            ++$failureCount;
                        } catch (Throwable $e) {
                            $this->logger->error(sprintf(
                                '发送中断消息时发生未知错误，话题ID: %d, 任务ID: %s, 沙箱ID: %s, 错误: %s',
                                $topicId,
                                $task->getTaskId(),
                                $task->getSandboxId(),
                                $e->getMessage()
                            ));
                            ++$failureCount;
                        }
                    }

                    $totalSuccessCount += $successCount;
                    $totalFailureCount += $failureCount;

                    $this->logger->info(sprintf(
                        '话题 %d 任务处理完成，成功: %d, 失败: %d',
                        $topicId,
                        $successCount,
                        $failureCount
                    ));
                } finally {
                    if ($this->releaseLock($lockKey, $lockOwner)) {
                        $this->logger->debug(sprintf(
                            '已释放话题 %d 的停止任务锁',
                            $topicId
                        ));
                    } else {
                        $this->logger->error(sprintf(
                            '释放话题 %d 的停止任务锁失败，可能需要人工干预',
                            $topicId
                        ));
                    }
                }
            }

            $this->logger->info(sprintf(
                '停止任务处理完成，类型: %s, ID: %d, 总成功: %d, 总失败: %d, 跳过话题数: %d',
                $event->getDataType()->value,
                $event->getDataId(),
                $totalSuccessCount,
                $totalFailureCount,
                $skippedTopicCount
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '停止任务处理失败，类型: %s, ID: %d, 错误: %s',
                $event->getDataType()->value,
                $event->getDataId(),
                $e->getMessage()
            ));
            throw $e;
        }
    }

    /**
     * 根据数据类型查询相关的运行中任务.
     *
     * @param StopRunningTaskEvent $event 停止任务事件
     * @return array 运行中的任务列表
     */
    private function queryRunningTasksByDataType(StopRunningTaskEvent $event): array
    {
        $runningTasks = [];

        switch ($event->getDataType()) {
            case DeleteDataType::WORKSPACE:
                // 查询工作区下所有运行中的话题（包括已删除的话题）
                $topicConditions = [
                    'workspace_id' => $event->getDataId(),
                    'current_task_status' => TaskStatus::RUNNING->value,
                ];
                $topicsResult = $this->queryTopicsIncludeDeleted($topicConditions);
                $topics = $topicsResult['list'] ?? [];

                // 查询这些话题下的运行中任务
                foreach ($topics as $topic) {
                    $tasks = $this->getRunningTasksByTopicId($topic->getId());
                    $runningTasks = array_merge($runningTasks, $tasks);
                }
                break;
            case DeleteDataType::PROJECT:
                // 查询项目下所有运行中的话题（包括已删除的话题）
                $topicConditions = [
                    'project_id' => $event->getDataId(),
                    'current_task_status' => TaskStatus::RUNNING->value,
                ];
                $topicsResult = $this->queryTopicsIncludeDeleted($topicConditions);
                $topics = $topicsResult['list'] ?? [];

                // 查询这些话题下的运行中任务
                foreach ($topics as $topic) {
                    $tasks = $this->getRunningTasksByTopicId($topic->getId());
                    $runningTasks = array_merge($runningTasks, $tasks);
                }
                break;
            case DeleteDataType::TOPIC:
                // 直接查询话题下的运行中任务
                $runningTasks = $this->getRunningTasksByTopicId($event->getDataId());
                break;
            default:
                $this->logger->warning(sprintf(
                    '未知的数据类型: %s',
                    $event->getDataType()->value
                ));
                break;
        }

        return $runningTasks;
    }

    /**
     * 查询话题，包括已删除的话题.
     * 这个方法用于停止任务场景，需要查询到已删除话题下的运行中任务.
     *
     * @param array $conditions 查询条件
     * @return array 话题列表
     */
    private function queryTopicsIncludeDeleted(array $conditions): array
    {
        // 由于标准的 getTopicsByConditions 会过滤掉已删除的话题，
        // 我们需要使用 withTrashed() 方法来获取包括已删除的话题
        $query = TopicModel::query()->withTrashed();

        // 应用条件过滤
        foreach ($conditions as $field => $value) {
            if (is_array($value)) {
                $query->whereIn($field, $value);
            } else {
                $query->where($field, $value);
            }
        }

        // 获取所有话题，包括已删除的
        $topics = $query->get();

        $this->logger->info(sprintf(
            '查询话题（包括已删除）：找到 %d 个话题，查询条件：%s',
            $topics->count(),
            json_encode($conditions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        ));

        // 转换为实体对象
        $list = [];
        foreach ($topics as $topic) {
            $list[] = new TopicEntity($topic->toArray());
        }

        return [
            'list' => $list,
            'total' => count($list),
        ];
    }

    /**
     * 根据话题ID获取运行中的任务.
     *
     * @param int $topicId 话题ID
     * @return array 运行中的任务列表
     */
    private function getRunningTasksByTopicId(int $topicId): array
    {
        $taskConditions = [
            'task_status' => [TaskStatus::RUNNING->value],
        ];

        $tasksResult = $this->taskRepository->getTasksByTopicId($topicId, 1, 1000, $taskConditions);
        return $tasksResult['list'] ?? [];
    }
}
