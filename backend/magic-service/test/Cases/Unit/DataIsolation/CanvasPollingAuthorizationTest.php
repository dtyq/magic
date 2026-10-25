<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\DataIsolation;

use App\Application\Design\Event\Subscribe\DesignVideoPollConsumer;
use App\Application\SuperMagic\Task\Service\AgentAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Design\Contract\VideoGatewayPayloadBuilderInterface;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\Design\Repository\Facade\DesignGenerationTaskRepositoryInterface;
use App\Domain\Design\Service\DesignCanvasCompositionSubmissionService;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\Design\Service\DesignVideoSubmissionDomainService;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\Design\Contract\VideoGatewayClientInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Amqp\Producer;
use Hyperf\Amqp\Result;
use InvalidArgumentException;
use PhpAmqpLib\Message\AMQPMessage;
use PHPUnit\Framework\Assert;
use Psr\Log\LoggerInterface;

/** 验证真实消费调用链的授权传递，所有外部依赖均为 Mock。
 * @internal
 */
final class CanvasPollingAuthorizationTest extends ContextTestCase
{
    /** 缓存沙箱分支不经过初始化，也必须把授权传到 Gateway。 */
    public function testCachedSandboxPollingForwardsAuthorization(): void
    {
        $this->poll(true);
    }

    /** 未缓存沙箱时，初始化与查询复用同一个当前用户隔离对象。 */
    public function testUncachedSandboxPollingForwardsAuthorization(): void
    {
        $this->poll(false);
    }

    /** 普通视频仍直接使用Provider，不创建或初始化沙箱用户上下文。 */
    public function testProviderOperationsDoNotRequireSandboxContext(): void
    {
        $this->services[MagicOrganizationEnvDomainService::class]->expects(self::never())->method('getOrganizationsEnvironmentDTO');
        $entity = $this->createMock(DesignGenerationTaskEntity::class);
        $entity->method('getOrganizationCode')->willReturn('mock-org');
        $entity->method('getUserId')->willReturn('mock-user');
        $entity->method('getOperationId')->willReturn('mock-operation');
        $builder = $this->createMock(VideoGatewayPayloadBuilderInterface::class);
        $builder->expects(self::once())->method('build')->with($entity)->willReturn(['model' => 'mock-model']);
        $gateway = $this->createMock(VideoGatewayClientInterface::class);
        $params = ['organization_code' => 'mock-org', 'user_id' => 'mock-user'];
        $gateway->expects(self::once())->method('submitVideo')->with(['model' => 'mock-model'], $params)->willReturn(['id' => 'mock-operation']);
        $gateway->expects(self::once())->method('queryVideo')->with('mock-operation', $params)->willReturn(['status' => 'running']);
        $service = new DesignVideoSubmissionDomainService($builder, $gateway);
        self::assertSame('mock-operation', $service->submit($entity)['operation_id']);
        self::assertSame('running', $service->query(new DesignDataIsolation('mock-org', 'mock-user'), $entity)['status']);
    }

    /** 组织或用户不匹配时拒绝把其他身份传给沙箱。 */
    public function testMismatchedIdentityIsRejectedBeforeGateway(): void
    {
        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->expects(self::never())->method('proxySandboxRequest');
        $service = $this->service(DesignCanvasCompositionSubmissionService::class, ['sandboxGateway' => $gateway]);
        $this->expectException(InvalidArgumentException::class);
        $service->query(new DesignDataIsolation('mock-org', 'mock-user'), $this->createMock(DesignGenerationTaskEntity::class), new DataIsolation('mock-org', 'mock-other-user'));
    }

    /** 用真实消费者和两层路由验证授权没有在领域层重建时丢失。 */
    private function poll(bool $cached): void
    {
        $authorization = $this->createMock(AgentDomainService::class);
        $authorization->expects(self::once())->method('getAuthorizationByUserId')->with('mock-user')->willReturn('mock-token');
        $this->services[AgentDomainService::class] = $authorization;
        $entity = $this->createMock(DesignGenerationTaskEntity::class);
        $entity->method('getProviderPayload')->willReturn($cached ? ['sandbox_id' => 'mock-sandbox'] : []);
        $entity->method('getGenerationId')->willReturn('mock-generation');
        $entity->method('getOperationId')->willReturn('mock-operation');
        $entity->method('getProjectId')->willReturn(1);
        $entity->method('getUserId')->willReturn('mock-user');
        $entity->method('isCanvasComposition')->willReturn(true);
        $entity->method('getGenerationType')->willReturn(DesignGenerationType::CANVAS_COMPOSITION);
        $entity->method('isFinal')->willReturn(false);
        $entity->method('canPoll')->willReturn(true);
        $entity->method('getPollDeadlineAt')->willReturn(null);
        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->expects(self::once())->method('proxySandboxRequest')->willReturnCallback(static function (DataIsolation $context, string $sandboxId): GatewayResult {
            self::assertSame('mock-org', $context->getCurrentOrganizationCode());
            self::assertSame('mock-user', $context->getCurrentUserId());
            self::assertSame('mock-sandbox', $sandboxId);
            self::assertSame('mock-token', $context->getUserAuthorizationToken());
            self::assertSame('mock-token', $context->getUserAuthorizationToken());
            return GatewayResult::success(['status' => 'running']);
        });
        $agent = new CanvasPollingAgentStub($cached);
        $topics = $this->createMock(TopicDomainService::class);
        $topic = $this->createMock(TopicEntity::class);
        $topic->method('getId')->willReturn(1);
        $topics->method('findHiddenTopicByProjectAndUser')->willReturn($topic);
        $canvas = $this->service(DesignCanvasCompositionSubmissionService::class, [
            'sandboxGateway' => $gateway,
            'agentAppService' => $agent,
            'topicDomainService' => $topics,
            'projectDomainService' => $this->createMock(ProjectDomainService::class),
        ]);
        $submission = $this->service(DesignVideoSubmissionDomainService::class, ['canvasCompositionService' => $canvas]);
        $repository = $this->createMock(DesignGenerationTaskRepositoryInterface::class);
        $repository->method('findByProjectAndGenerationId')->willReturn($entity);
        $repository->expects(self::once())->method('update');
        $domain = new DesignGenerationTaskDomainService($repository);
        $producer = $this->createMock(Producer::class);
        $producer->expects(self::once())->method('produce');
        $consumer = $this->service(DesignVideoPollConsumer::class, [
            'domainService' => $domain,
            'submissionDomainService' => $submission,
            'producer' => $producer,
            'logger' => $this->createMock(LoggerInterface::class),
        ]);
        self::assertSame(Result::ACK, $consumer->consumeMessage([
            'organization_code' => 'mock-org', 'project_id' => 1, 'generation_id' => 'mock-generation',
        ], new AMQPMessage()));
    }
}

/** 用离线替身隔离只读应用服务的沙箱初始化。 */
readonly class CanvasPollingAgentStub extends AgentAppService
{
    /** 标记缓存路径应跳过初始化。 */
    public function __construct(private bool $cached)
    {
    }

    /** 未缓存路径只检查身份授权并返回占位沙箱。 */
    public function ensureSandboxInitialized(DataIsolation $dataIsolation, int $topicId, bool $skipInitMessages = false, ?SandboxImageTarget $images = null): string
    {
        Assert::assertFalse($this->cached);
        Assert::assertSame('mock-token', $dataIsolation->getUserAuthorizationToken());
        return 'mock-sandbox';
    }
}
