<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAccessAppService;
use App\Application\SuperMagic\Task\Service\TopicTaskAppService;
use App\Application\SuperMagic\Topic\Service\TopicAgentConfigResolver;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Agent\Entity\UserAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Service\UserAgentDomainService;
use App\Domain\SuperMagic\Message\Entity\MessageQueueEntity;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageQueueWriteResult;
use App\Domain\SuperMagic\Message\Service\MessageQueueDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\SuperAgentErrorCode;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateOpenTaskRequestDTO;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Snowflake\IdGeneratorInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;
use Throwable;

/**
 * @internal
 */
final class TopicTaskAppServiceAutoHireTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(static fn (string $key) => $key);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());
        $config = new Config([
            'app_env' => 'testing',
            'super-magic' => ['topic' => ['config_fixed' => true]],
            'error_message' => ['error_code_mapper' => [SuperMagicErrorCode::class => [60000, 60999], SuperAgentErrorCode::class => [51000, 51299]]],
        ]);
        $authorizationAgent = $this->createMock(AgentDomainService::class);
        $authorizationAgent->method('getAuthorizationByUserId')->willReturn('test-authorization');
        $idGenerator = $this->createMock(IdGeneratorInterface::class);
        $idGenerator->method('generate')->willReturn(999);
        $container = $this->createMock(\Hyperf\Contract\ContainerInterface::class);
        $managers = [];
        foreach ([ThirdPlatformDataIsolationManagerInterface::class, SubscriptionManagerInterface::class, OrganizationInfoManagerInterface::class] as $manager) {
            $managers[$manager] = $this->createMock($manager);
        }
        $container->method('make')->willReturnCallback(static fn (string $id) => $managers[$id]);
        $container->method('has')->willReturn(true);
        $container->method('get')->willReturnCallback(static fn (string $id) => match ($id) {
            ConfigInterface::class => $config,
            TranslatorInterface::class => $translator,
            LoggerFactory::class => $loggerFactory,
            AgentDomainService::class => $authorizationAgent,
            IdGeneratorInterface::class => $idGenerator,
            default => throw new RuntimeException('Unexpected dependency: ' . $id),
        });
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, $this->previousContainer);
    }

    public function testHiresTheFixedTopicEmployeeBeforeQueueingAndRechecksAccess(): void
    {
        [$service, $hire, $access, $queue] = $this->service();
        $hire->expects($this->once())->method('findUserAgentOwnershipByCode')->with($this->callback(static fn (SuperMagicAgentDataIsolation $isolation) => $isolation->getCurrentUserId() === 'user-1' && $isolation->getCurrentOrganizationCode() === 'org-1'), 'SMA-topic')->willReturn(new UserAgentEntity());
        $access->expects($this->exactly(2))->method('checkAgentAccess')->with($this->anything(), 'custom_agent', 'SMA-topic')->willReturnOnConsecutiveCalls([false, 'unavailable'], [true, '']);
        $queue->expects($this->once())->method('createMessage')->willReturn(new MessageQueueWriteResult((new MessageQueueEntity())->setId(123), true));
        self::assertSame(['task_id' => '', 'queue_id' => '123'], $this->createOpenTask($service, $this->request(true)));
    }

    public function testDisabledAutoHirePreservesTheExistingAccessError(): void
    {
        [$service, $hire, $access, $queue] = $this->service();
        $hire->expects($this->never())->method('findUserAgentOwnershipByCode');
        $queue->expects($this->never())->method('createMessage');
        $access->method('checkAgentAccess')->willReturn([false, 'unavailable']);
        $this->expectExceptionCode(SuperMagicErrorCode::OperationFailed->value);
        $this->createOpenTask($service, $this->request(false));
    }

    #[DataProvider('accessibleModes')]
    public function testAccessibleEmployeesAndBuiltinModesSkipHiring(string $mode): void
    {
        [$service, $hire, $access, $queue] = $this->service($mode);
        $hire->expects($this->never())->method('findUserAgentOwnershipByCode');
        $access->expects($this->once())->method('checkAgentAccess')->willReturn([true, '']);
        $queue->method('createMessage')->willReturn(new MessageQueueWriteResult((new MessageQueueEntity())->setId(123), true));
        self::assertSame('123', $this->createOpenTask($service, $this->request(true))['queue_id']);
    }

    public static function accessibleModes(): array
    {
        return ['hired employee' => ['SMA-topic'], 'builtin mode' => ['general']];
    }

    #[DataProvider('hireFailures')]
    public function testHireFailureReturnsDedicatedCodeWithoutQueueingOrCreatingTask(Throwable $cause): void
    {
        [$service, $hire, $access, $queue] = $this->service();
        $hire->method('findUserAgentOwnershipByCode')->willThrowException($cause);
        $access->expects($this->once())->method('checkAgentAccess')->willReturn([false, 'unavailable']);
        $queue->expects($this->never())->method('createMessage');
        try {
            $this->createOpenTask($service, $this->request(true));
            self::fail('Expected auto hire failure');
        } catch (BusinessException $exception) {
            self::assertSame(60014, $exception->getCode());
            self::assertSame($cause, $exception->getPrevious());
            self::assertSame('super_magic.task.auto_hire_agent_failed', $exception->getMessage());
        }
    }

    public static function hireFailures(): array
    {
        return [
            'infrastructure' => [new RuntimeException('Database failure')],
            'market unavailable' => [new BusinessException('Market unavailable', 60002)],
        ];
    }

    public function testFlexibleTopicHiresTheRequestedEmployee(): void
    {
        ApplicationContext::getContainer()->get(ConfigInterface::class)->set('super-magic.topic.config_fixed', false);
        [$service, $hire, $access, $queue] = $this->service();
        $hire->expects($this->once())->method('findUserAgentOwnershipByCode')->with($this->anything(), 'SMA-request')->willReturn(new UserAgentEntity());
        $access->method('checkAgentAccess')->willReturnOnConsecutiveCalls([false, 'unavailable'], [true, '']);
        $queue->method('createMessage')->willReturn(new MessageQueueWriteResult((new MessageQueueEntity())->setId(123), true));
        self::assertSame('123', $this->createOpenTask($service, $this->request(true))['queue_id']);
    }

    public function testFirstPartyTaskCreationNeverAutoHires(): void
    {
        [$service, $hire, $access, $queue] = $this->service();
        $hire->expects($this->never())->method('findUserAgentOwnershipByCode');
        $access->method('checkAgentAccess')->willReturn([false, 'unavailable']);
        $queue->expects($this->never())->method('createMessage');
        $this->expectExceptionCode(SuperMagicErrorCode::OperationFailed->value);
        $service->createTask($this->context(), $this->request(true)->toCreateTaskRequestDTO());
    }

    public function testHireFailurePreventsForcedTaskInterruption(): void
    {
        [$service, $hire, $access, $queue] = $this->service();
        $hire->method('findUserAgentOwnershipByCode')->willThrowException(new BusinessException('Market unavailable', 60002));
        $access->method('checkAgentAccess')->willReturn([false, 'unavailable']);
        $queue->expects($this->never())->method('createMessage');
        $dto = $this->request(true)->toCreateTaskRequestDTO();
        $dto->forceInterrupt = true;
        $this->expectExceptionCode(SuperMagicErrorCode::AutoHireAgentFailed->value);
        (new ReflectionMethod(TopicTaskAppService::class, 'createTaskByDataIsolation'))->invoke(
            $service,
            DataIsolation::create('org-1', 'user-1'),
            $dto,
            autoHireAgent: true
        );
    }

    public function testProjectMismatchIsRejectedBeforeHiring(): void
    {
        [$service, $hire, $access, $queue] = $this->service();
        $hire->expects($this->never())->method('findUserAgentOwnershipByCode');
        $access->expects($this->never())->method('checkAgentAccess');
        $queue->expects($this->never())->method('createMessage');
        $dto = $this->request(true);
        $dto->projectId = '99';
        $this->expectExceptionCode(SuperAgentErrorCode::VALIDATE_FAILED->value);
        $this->createOpenTask($service, $dto);
    }

    public function testTopicOwnershipFailureDoesNotHire(): void
    {
        [$service, $hire, $access, $queue] = $this->service(userId: 'other-user');
        $hire->expects($this->never())->method('findUserAgentOwnershipByCode');
        $access->expects($this->never())->method('checkAgentAccess');
        $queue->expects($this->never())->method('createMessage');
        $this->expectExceptionCode(SuperAgentErrorCode::TOPIC_ACCESS_DENIED->value);
        $this->createOpenTask($service, $this->request(true));
    }

    public function testMagicClawPermissionFailureIsNotConvertedToHiring(): void
    {
        [$service, $hire, $access, $queue] = $this->service('magiclaw');
        $hire->expects($this->never())->method('findUserAgentOwnershipByCode');
        $access->method('checkAgentAccess')->willReturn([false, 'unavailable']);
        $queue->expects($this->never())->method('createMessage');
        $this->expectExceptionCode(SuperMagicErrorCode::OperationFailed->value);
        $this->createOpenTask($service, $this->request(true));
    }

    public function testAccessStillDeniedAfterHiringKeepsTheOriginalError(): void
    {
        [$service, $hire, $access, $queue] = $this->service();
        $hire->expects($this->once())->method('findUserAgentOwnershipByCode')->willReturn(new UserAgentEntity());
        $access->expects($this->exactly(2))->method('checkAgentAccess')->willReturn([false, 'unavailable']);
        $queue->expects($this->never())->method('createMessage');
        $this->expectExceptionCode(SuperMagicErrorCode::OperationFailed->value);
        $this->createOpenTask($service, $this->request(true));
    }

    public function testLaterTaskFailureKeepsItsCauseAndDoesNotDismissTheEmployee(): void
    {
        [$service, $hire, $access, $queue] = $this->service();
        $hire->expects($this->once())->method('findUserAgentOwnershipByCode')->willReturn(new UserAgentEntity());
        $hire->expects($this->never())->method('deleteUserAgentOwnership');
        $access->method('checkAgentAccess')->willReturnOnConsecutiveCalls([false, 'unavailable'], [true, '']);
        $cause = new RuntimeException('Queue unavailable');
        $queue->method('createMessage')->willThrowException($cause);
        $this->expectExceptionObject($cause);
        $this->createOpenTask($service, $this->request(true));
    }

    private function service(string $mode = 'SMA-topic', string $userId = 'user-1'): array
    {
        $topic = (new TopicEntity())->setId(2)->setUserId($userId)->setProjectId(1)->setTopicMode($mode)->setAgentCode('SMA-topic')->setCurrentTaskStatus(TaskStatus::RUNNING);
        $topics = $this->createMock(TopicDomainService::class);
        $topics->method('getTopicById')->willReturn($topic);
        $hire = $this->createMock(UserAgentDomainService::class);
        $access = $this->createMock(SuperMagicAgentAccessAppService::class);
        $queue = $this->createMock(MessageQueueDomainService::class);
        $events = $this->createMock(EventDispatcherInterface::class);
        $tasks = $this->createMock(TaskDomainService::class);
        $tasks->expects($this->never())->method('initTopicTask');
        $agent = $this->createMock(AgentDomainService::class);
        $agent->expects($this->never())->method('getSandboxStatus');
        $service = (new ReflectionClass(TopicTaskAppService::class))->newInstanceWithoutConstructor();
        foreach ([
            'topicDomainService' => $topics, 'userAgentDomainService' => $hire,
            'superMagicAgentAccessAppService' => $access, 'topicAgentConfigResolver' => new TopicAgentConfigResolver(),
            'messageQueueDomainService' => $queue, 'eventDispatcher' => $events,
            'taskDomainService' => $tasks, 'agentDomainService' => $agent, 'logger' => new NullLogger(),
        ] as $property => $value) {
            (new ReflectionProperty(TopicTaskAppService::class, $property))->setValue($service, $value);
        }
        return [$service, $hire, $access, $queue];
    }

    private function createOpenTask(TopicTaskAppService $service, CreateOpenTaskRequestDTO $request): array
    {
        return $service->createTaskFromOpenApi($this->context(), $request, $request->toCreateTaskRequestDTO());
    }

    private function request(bool $autoHire): CreateOpenTaskRequestDTO
    {
        return new CreateOpenTaskRequestDTO([
            'project_id' => '1', 'topic_id' => '2', 'content' => 'Analyze sales',
            'agent_mode' => 'SMA-request', 'auto_hire_agent' => $autoHire,
        ]);
    }

    private function context(): RequestContext
    {
        $context = $this->createMock(RequestContext::class);
        $context->method('getUserAuthorization')->willReturn((new MagicUserAuthorization())->setId('user-1')->setOrganizationCode('org-1'));
        return $context;
    }
}
