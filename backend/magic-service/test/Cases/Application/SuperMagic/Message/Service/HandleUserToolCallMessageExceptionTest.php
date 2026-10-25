<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Message\Service;

use App\Application\Kernel\DataIsolationInitializer;
use App\Application\MCP\SupperMagicMCP\ProjectMcpConfigService;
use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAccessAppService;
use App\Application\SuperMagic\Message\DTO\UserMessageDTO;
use App\Application\SuperMagic\Message\Service\HandleUserMessageAppService;
use App\Application\SuperMagic\Task\Service\AgentAppService;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountPlanner;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountService;
use App\Application\SuperMagic\Task\Service\TopicTaskAppService;
use App\Application\SuperMagic\Topic\Service\TopicAgentConfigResolver;
use App\Domain\Chat\DTO\Message\ChatMessage\UserToolCallMessage;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\EventErrorCode;
use App\Infrastructure\Core\DataIsolation\DataIsolationInitializerInterface;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\UserToolCallNotFoundException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\AssertionFailedError;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionClass;

/**
 * user_tool_call 回复的异常转换测试.
 *
 * 沙箱判定“问题已被超时消费或重复提交”(UserToolCallNotFoundException) 时，
 * 应用层必须转换为 EventException(6607) 走温和提醒通道，
 * 而不是让异常冒泡到 subscriber 的 Throwable 分支触发“任务异常”错误消息；
 * 其他沙箱故障(SandboxOperationException)必须原样重抛，保持既有行为。
 *
 * @internal
 */
class HandleUserToolCallMessageExceptionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturn('test');

        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(
            static fn (string $key): string => $key === 'super_magic.task.question_expired' ? '该问题已超时或已被处理' : $key
        );

        $container = new FakeContainer();
        $container->services[ConfigInterface::class] = $config;
        $container->services[TranslatorInterface::class] = $translator;

        // 隔离基础上下文管理器，仅注册延迟回调，不访问真实用户或环境。
        $container->services[DataIsolationInitializerInterface::class] = new DataIsolationInitializer();
        $container->services[ThirdPlatformDataIsolationManagerInterface::class] = $this->createMock(ThirdPlatformDataIsolationManagerInterface::class);
        $container->services[SubscriptionManagerInterface::class] = $this->createMock(SubscriptionManagerInterface::class);
        $container->services[OrganizationInfoManagerInterface::class] = $this->createMock(OrganizationInfoManagerInterface::class);

        ApplicationContext::setContainer($container);
    }

    public function testExpiredQuestionConvertsToEventException(): void
    {
        $topicTaskAppService = $this->createMock(TopicTaskAppServiceForTest::class);
        $topicTaskAppService->expects($this->once())
            ->method('handleUserToolCallReply')
            ->willThrowException(new UserToolCallNotFoundException('问题不存在或已超时', 4100));

        $service = $this->buildService($topicTaskAppService);

        try {
            $service->handleUserToolCallMessage($this->buildDataIsolation(), $this->buildUserMessageDTO(), $this->buildToolCallMessage());
            throw new AssertionFailedError('Expected EventException was not thrown');
        } catch (EventException $e) {
            $this->assertSame(EventErrorCode::EVENT_USER_TOOL_CALL_EXPIRED->value, $e->getCode());
            $this->assertSame('该问题已超时或已被处理', $e->getMessage());
        }
    }

    public function testOtherSandboxFailureIsRethrown(): void
    {
        $topicTaskAppService = $this->createMock(TopicTaskAppServiceForTest::class);
        $topicTaskAppService->method('handleUserToolCallReply')
            ->willThrowException(new SandboxOperationException('Send user_tool_call feedback', 'boom', 2000));

        $service = $this->buildService($topicTaskAppService);

        $this->expectException(SandboxOperationException::class);
        $service->handleUserToolCallMessage($this->buildDataIsolation(), $this->buildUserMessageDTO(), $this->buildToolCallMessage());
    }

    public function testSuccessForwardsOnce(): void
    {
        $topicTaskAppService = $this->createMock(TopicTaskAppServiceForTest::class);
        $topicTaskAppService->expects($this->once())
            ->method('handleUserToolCallReply')
            ->with(
                $this->anything(),
                'chat-topic-1',
                'ask_user',
                'call_1',
                []
            );

        $service = $this->buildService($topicTaskAppService);
        $service->handleUserToolCallMessage($this->buildDataIsolation(), $this->buildUserMessageDTO(), $this->buildToolCallMessage());

        $this->assertTrue(true);
    }

    private function buildService(TopicTaskAppServiceForTest $topicTaskAppService): HandleUserMessageAppService
    {
        // 构造依赖中只有 topicTaskAppService 参与被测路径，其余仅需可构造。
        // 部分依赖是 readonly 无法 mock，用反射跳过构造函数创建。
        return new HandleUserMessageAppService(
            $this->stub(TopicDomainService::class),
            $this->stub(TaskDomainService::class),
            $this->stub(MagicDepartmentUserDomainService::class),
            $topicTaskAppService,
            $this->stub(TopicAgentConfigResolver::class),
            $this->stub(AgentDomainService::class),
            $this->stub(AgentAppService::class),
            $this->stub(LongTermMemoryDomainService::class),
            $this->stub(TaskFileDomainService::class),
            $this->stub(ProjectMcpConfigService::class),
            $this->stub(SuperMagicAgentAccessAppService::class),
            $this->stub(ReferencedProjectMountPlanner::class),
            $this->stub(ReferencedProjectMountService::class),
            $this->stub(Redis::class),
            $this->buildLoggerFactory()
        );
    }

    /**
     * 创建一个不调用构造函数的依赖占位实例（不做实际调用，仅满足构造签名）。
     */
    private function stub(string $class): object
    {
        $reflection = new ReflectionClass($class);
        if ($reflection->isInstantiable()) {
            return $reflection->newInstanceWithoutConstructor();
        }

        return $this->createMock($class);
    }

    private function buildLoggerFactory(): LoggerFactory
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        return $loggerFactory;
    }

    private function buildDataIsolation(): DataIsolation
    {
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId('usi_test_user');

        return $dataIsolation;
    }

    private function buildUserMessageDTO(): UserMessageDTO
    {
        return new UserMessageDTO(
            agentUserId: 'usi_agent',
            chatConversationId: 'conv-1',
            chatTopicId: 'chat-topic-1',
            topicId: 1,
            prompt: '',
        );
    }

    private function buildToolCallMessage(): UserToolCallMessage
    {
        $message = new UserToolCallMessage();
        $message->setName('ask_user');
        $message->setToolCallId('call_1');

        return $message;
    }
}

/**
 * 被测服务依赖的 TopicTaskAppService（非 final，可被 mock 覆盖被测方法）。
 * @internal
 */
class TopicTaskAppServiceForTest extends TopicTaskAppService
{
}

class FakeContainer implements ContainerInterface
{
    /** @var array<string, mixed> */
    public array $services = [];

    public function get(string $id): mixed
    {
        return $this->services[$id] ?? null;
    }

    /** 使用已注册的离线依赖模拟容器实例化。 */
    public function make(string $id, array $parameters = []): mixed
    {
        return $this->get($id);
    }

    public function has(string $id): bool
    {
        return isset($this->services[$id]);
    }
}
