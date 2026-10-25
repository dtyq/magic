<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Task\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\MagicClawRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use App\Domain\SuperMagic\Common\Entity\ValueObject\DynamicConfig\DynamicConfigManager;
use App\Domain\SuperMagic\Message\Repository\Facade\TaskMessageRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\CrossProjectMentionPathTranslator;
use App\Domain\SuperMagic\Topic\Repository\Facade\TopicRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\SandboxAgentInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\UserToolCallNotFoundException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Snowflake\IdGeneratorInterface;
use PHPUnit\Framework\AssertionFailedError;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;

/**
 * user_tool_call 回传错误分流测试.
 *
 * 沙箱对“问题已被超时消费或重复提交”返回专用错误码 USER_TOOL_CALL_NOT_FOUND(4100)，
 * 必须与通用沙箱故障(2000)区分：前者抛 UserToolCallNotFoundException 供上层转为温和提醒，
 * 后者保持 SandboxOperationException 原行为。判定只依赖响应码，不依赖 message 文案。
 *
 * @internal
 */
class AgentDomainServiceSendUserToolCallFeedbackTest extends TestCase
{
    private FakeContainer $container;

    /**
     * 被替换掉的原始容器，tearDown 时还回去。
     *
     * 这里替换的是进程级的 ApplicationContext。下面那个桩 ConfigInterface 对**任何**
     * key 都返回字符串 'test'，所以只要不还原，同一进程里后续每个测试的
     * config('error_message') 都会是 'test'，ExceptionBuilder::__construct 里的
     * array_merge(array, 'test') 立刻 TypeError —— 任何抛业务异常的测试都会莫名其妙地挂。
     */
    private ?ContainerInterface $originalContainer = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->originalContainer = ApplicationContext::hasContainer()
            ? ApplicationContext::getContainer()
            : null;

        $idGenerator = $this->createMock(IdGeneratorInterface::class);
        $idGenerator->method('generate')->willReturnCallback(static fn (): int => random_int(1, PHP_INT_MAX));

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturn('test');

        $this->container = new FakeContainer();
        $this->container->services[IdGeneratorInterface::class] = $idGenerator;
        $this->container->services[ConfigInterface::class] = $config;

        ApplicationContext::setContainer($this->container);
    }

    protected function tearDown(): void
    {
        if ($this->originalContainer !== null) {
            ApplicationContext::setContainer($this->originalContainer);
            $this->originalContainer = null;
        }

        parent::tearDown();
    }

    public function testExpiredQuestionThrowsDedicatedException(): void
    {
        $agent = $this->createMock(SandboxAgentInterface::class);
        $agent->method('sendChatMessage')->willReturn(
            AgentResponse::fromApiResponse([
                'code' => ResponseCode::USER_TOOL_CALL_NOT_FOUND,
                'message' => '问题不存在或已超时',
                'data' => [],
            ])
        );

        $service = $this->buildService($agent);

        try {
            $service->sendUserToolCallFeedback($this->buildDataIsolation(), 'sandbox-1', 'ask_user', 'call_1', []);
            throw new AssertionFailedError('Expected UserToolCallNotFoundException was not thrown');
        } catch (UserToolCallNotFoundException $e) {
            $this->assertSame(ResponseCode::USER_TOOL_CALL_NOT_FOUND, $e->getCode());
        }
    }

    public function testGenericSandboxErrorStillThrowsSandboxOperationException(): void
    {
        $agent = $this->createMock(SandboxAgentInterface::class);
        $agent->method('sendChatMessage')->willReturn(
            AgentResponse::fromApiResponse([
                'code' => ResponseCode::ERROR,
                'message' => 'boom',
                'data' => [],
            ])
        );

        $service = $this->buildService($agent);

        $this->expectException(SandboxOperationException::class);
        $service->sendUserToolCallFeedback($this->buildDataIsolation(), 'sandbox-1', 'ask_user', 'call_1', []);
    }

    public function testSuccessDoesNotThrow(): void
    {
        $agent = $this->createMock(SandboxAgentInterface::class);
        $agent->expects($this->once())->method('sendChatMessage')->willReturn(
            AgentResponse::fromApiResponse([
                'code' => ResponseCode::SUCCESS,
                'message' => 'ok',
                'data' => [],
            ])
        );

        $service = $this->buildService($agent);

        $service->sendUserToolCallFeedback($this->buildDataIsolation(), 'sandbox-1', 'ask_user', 'call_1', []);

        $this->assertTrue(true);
    }

    private function buildService(SandboxAgentInterface $agent): AgentDomainService
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        return new AgentDomainService(
            $loggerFactory,
            $this->createMock(SandboxGatewayInterface::class),
            $agent,
            $this->createMock(MagicUserInfoAppService::class),
            $this->createMock(CloudFileRepositoryInterface::class),
            $this->createMock(DynamicConfigManager::class),
            $this->createMock(MagicClawRepositoryInterface::class),
            $this->createMock(SuperMagicAgentRepositoryInterface::class),
            $this->createMock(MagicTokenRepositoryInterface::class),
            $this->createMock(ProjectRepositoryInterface::class),
            $this->createMock(TopicRepositoryInterface::class),
            $this->createMock(WorkspaceRepositoryInterface::class),
            $this->createMock(TaskMessageRepositoryInterface::class),
            new CrossProjectMentionPathTranslator(),
        );
    }

    private function buildDataIsolation(): DataIsolation
    {
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId('usi_test_user');

        return $dataIsolation;
    }
}

class FakeContainer implements ContainerInterface
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
