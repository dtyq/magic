<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Message\Service;

use App\Application\MCP\SupperMagicMCP\ProjectMcpConfigService;
use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAccessAppService;
use App\Application\SuperMagic\Message\DTO\UserMessageDTO;
use App\Application\SuperMagic\Message\Service\HandleUserMessageAppService;
use App\Application\SuperMagic\Task\Service\AgentAppService;
use App\Application\SuperMagic\Task\Service\TopicTaskAppService;
use App\Application\SuperMagic\Topic\Service\TopicAgentConfigResolver;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\CreationSource;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\EventErrorCode;
use App\Infrastructure\Core\Exception\EventException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use Throwable;

/**
 * 发起沙箱前的文件数量上限校验测试.
 *
 * handleChatMessage 在校验项目空间/用户空间文件数达到上限时，
 * 必须抛出 EventException(EVENT_DATA_VALIDATION_FAILED) 走温和提醒通道，
 * 而不是继续创建沙箱任务。
 *
 * @internal
 */
class HandleChatMessageFileCountLimitTest extends TestCase
{
    private const FILE_COUNT_LIMIT = 5000;

    protected function setUp(): void
    {
        parent::setUp();

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(
            static fn (string $key, mixed $default = null): mixed => match ($key) {
                'super-magic.file_limit.max_count' => self::FILE_COUNT_LIMIT,
                'app_env' => 'testing',
                default => $default,
            }
        );

        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(
            static fn (string $key, array $replace = []): string => $key . ':' . ($replace['limit'] ?? '')
        );

        $container = new FileCountLimitFakeContainer();
        $container->services[ConfigInterface::class] = $config;
        $container->services[TranslatorInterface::class] = $translator;

        ApplicationContext::setContainer($container);
    }

    public function testProjectFileCountExceededThrowsEventException(): void
    {
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->method('countProjectFilesWithLimit')->willReturn(self::FILE_COUNT_LIMIT);
        // 项目空间已超限，直接拦截，不应再统计用户空间
        $taskFileDomainService->expects($this->never())->method('countUserSpaceFilesWithLimit');

        $service = $this->buildService($taskFileDomainService);

        try {
            $service->handleChatMessage($this->buildDataIsolation(), $this->buildUserMessageDTO());
            $this->fail('Expected EventException was not thrown');
        } catch (EventException $e) {
            $this->assertSame(EventErrorCode::EVENT_DATA_VALIDATION_FAILED->value, $e->getCode());
            $this->assertSame('super_magic.task.project_file_count_exceeded:' . self::FILE_COUNT_LIMIT, $e->getMessage());
        }
    }

    public function testUserSpaceFileCountExceededThrowsEventException(): void
    {
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->method('countProjectFilesWithLimit')->willReturn(self::FILE_COUNT_LIMIT - 1);
        $taskFileDomainService->method('countUserSpaceFilesWithLimit')->willReturn(self::FILE_COUNT_LIMIT);

        $service = $this->buildService($taskFileDomainService);

        try {
            $service->handleChatMessage($this->buildDataIsolation(), $this->buildUserMessageDTO());
            $this->fail('Expected EventException was not thrown');
        } catch (EventException $e) {
            $this->assertSame(EventErrorCode::EVENT_DATA_VALIDATION_FAILED->value, $e->getCode());
            $this->assertSame('super_magic.task.user_space_file_count_exceeded:' . self::FILE_COUNT_LIMIT, $e->getMessage());
        }
    }

    public function testBelowLimitPassesFileCountCheck(): void
    {
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->method('countProjectFilesWithLimit')->willReturn(0);
        $taskFileDomainService->method('countUserSpaceFilesWithLimit')->willReturn(0);

        $service = $this->buildService($taskFileDomainService);

        // 文件数校验通过后流程继续往下走，下游依赖（雪崩ID、事件分发等）在单测环境
        // 会以任意异常中断，只要不是文件数超限的 EventException 即证明校验已放行。
        try {
            $service->handleChatMessage($this->buildDataIsolation(), $this->buildUserMessageDTO());
        } catch (EventException $e) {
            $this->fail('File count check should pass but got EventException: ' . $e->getMessage());
        } catch (Throwable) {
            // 下游依赖在单测容器下不可用，抛出其他异常属于预期
        }

        $this->addToAssertionCount(1);
    }

    private function buildService(TaskFileDomainService $taskFileDomainService): HandleUserMessageAppService
    {
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $topicDomainService->method('getTopicByChatTopicId')->willReturn($this->buildTopicEntity());

        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $projectDomainService->method('getProjectNotUserId')->willReturn($this->buildProjectEntity());

        /** @var FileCountLimitFakeContainer $container */
        $container = ApplicationContext::getContainer();
        $container->services[ProjectDomainService::class] = $projectDomainService;

        return new HandleUserMessageAppService(
            $topicDomainService,
            $this->stub(TaskDomainService::class),
            $this->stub(MagicDepartmentUserDomainService::class),
            $this->stub(TopicTaskAppService::class),
            $this->stub(TopicAgentConfigResolver::class),
            $this->stub(AgentDomainService::class),
            $this->stub(AgentAppService::class),
            $this->stub(LongTermMemoryDomainService::class),
            $taskFileDomainService,
            $this->stub(ProjectMcpConfigService::class),
            $this->stub(SuperMagicAgentAccessAppService::class),
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

    private function buildTopicEntity(): TopicEntity
    {
        $topicEntity = new TopicEntity();
        $topicEntity->setId(1);
        $topicEntity->setProjectId(100);
        $topicEntity->setSource(CreationSource::USER_CREATED->value);

        return $topicEntity;
    }

    private function buildProjectEntity(): ProjectEntity
    {
        $projectEntity = new ProjectEntity();
        $projectEntity->setId(100);
        // 与当前用户一致，走 getAccessibleProject 的创建者快速返回路径
        $projectEntity->setUserId('usi_test_user');

        return $projectEntity;
    }

    private function buildDataIsolation(): DataIsolation
    {
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId('usi_test_user');
        $dataIsolation->setCurrentOrganizationCode('org_test');

        return $dataIsolation;
    }

    private function buildUserMessageDTO(): UserMessageDTO
    {
        return new UserMessageDTO(
            agentUserId: 'usi_agent',
            chatConversationId: 'conv-1',
            chatTopicId: 'chat-topic-1',
            topicId: 1,
            prompt: 'hello',
        );
    }
}

class FileCountLimitFakeContainer implements ContainerInterface
{
    /** @var array<string, mixed> */
    public array $services = [];

    public function get(string $id): mixed
    {
        return $this->services[$id] ?? null;
    }

    public function has(string $id): bool
    {
        return isset($this->services[$id]);
    }
}
