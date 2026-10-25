<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Event\Subscribe;

use App\Application\Design\Event\Publish\DesignVideoPollDelayPublisher;
use App\Application\Design\Event\Subscribe\DesignVideoSubmitConsumer;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ValueObject\DesignGenerationAssetType;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\Design\Factory\DesignGenerationTaskFactory;
use App\Domain\Design\Repository\Facade\DesignGenerationTaskRepositoryInterface;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\Design\Service\DesignVideoSubmissionDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use Hyperf\Amqp\Producer;
use HyperfTest\Cases\Unit\DataIsolation\ContextTestCase;
use PhpAmqpLib\Message\AMQPMessage;
use PHPUnit\Framework\Assert;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class DesignVideoSubmitConsumerTest extends ContextTestCase
{
    public function testCanvasCompositionIsSubmittedAndThenDispatchedForPolling(): void
    {
        $authorization = $this->createMock(AgentDomainService::class);
        $authorization->expects(self::once())->method('getAuthorizationByUserId')->with('user-1')->willReturn('mock-token');
        $this->services[AgentDomainService::class] = $authorization;
        $entity = $this->createPendingCanvasCompositionEntity();
        $repository = new SubmitConsumerInMemoryRepository($entity);
        $producer = $this->createMock(Producer::class);
        $producer->expects($this->once())
            ->method('produce')
            ->with($this->isInstanceOf(DesignVideoPollDelayPublisher::class));
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->once())
            ->method('info')
            ->with(
                'design video async submit succeeded',
                $this->callback(static fn (array $context): bool => ($context['video_id'] ?? '') === 'composition-1'
                    && ($context['sandbox_id'] ?? '') === 'sandbox-1'
                    && ($context['operation_id'] ?? '') === 'composition-operation-1')
            );

        $consumer = new DesignVideoSubmitConsumer(
            new DesignGenerationTaskDomainService($repository),
            new SubmitConsumerSubmissionDomainService(),
            $producer,
            $logger,
        );

        $consumer->consumeMessage([
            'organization_code' => 'org',
            'project_id' => 123,
            'generation_id' => 'composition-1',
        ], new AMQPMessage());

        $this->assertSame('composition-operation-1', $entity->getOperationId());
        $this->assertSame('sent', $entity->getFirstPollStatus());
        $this->assertGreaterThanOrEqual(2, $repository->updateCount);
    }

    private function createPendingCanvasCompositionEntity(): DesignGenerationTaskEntity
    {
        $entity = DesignGenerationTaskFactory::createVideoTask(new DesignVideoCreateDTO([
            'project_id' => 123,
            'video_id' => 'composition-1',
            'generation_type' => DesignGenerationType::CANVAS_COMPOSITION->value,
            'topic_id' => '456',
            'extensions' => [
                'project_path' => 'canvas-project',
                'video_edit_element_id' => 'video-edit-1',
                'output_file_name' => 'final.mp4',
            ],
        ]));
        $entity->setOrganizationCode('org');
        $entity->setUserId('user-1');
        $entity->prepareForCreate();
        $entity->setId(1001);
        return $entity;
    }
}

readonly class SubmitConsumerSubmissionDomainService extends DesignVideoSubmissionDomainService
{
    public function __construct()
    {
    }

    /** 验证消费者为提交链注册授权，避免依赖沙箱初始化的隐式副作用。 */
    public function submitCanvasComposition(DesignGenerationTaskEntity $entity, DataIsolation $contactIsolation): array
    {
        Assert::assertSame('mock-token', $contactIsolation->getUserAuthorizationToken());
        return [
            'provider' => 'super_magic',
            'submit_endpoint' => 'api/sandbox/tasks',
            'operation_id' => 'composition-operation-1',
            'sandbox_id' => 'sandbox-1',
            'submitted_at' => date(DATE_ATOM),
            'poll_attempts' => 0,
            'deadline_at' => date(DATE_ATOM, time() + 3600),
        ];
    }
}

class SubmitConsumerInMemoryRepository implements DesignGenerationTaskRepositoryInterface
{
    public int $updateCount = 0;

    public function __construct(private readonly DesignGenerationTaskEntity $entity)
    {
    }

    public function create(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
    }

    public function update(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        ++$this->updateCount;
    }

    public function delete(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
    }

    public function findByProjectAndGenerationId(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        DesignGenerationAssetType $assetType,
        string $generationId
    ): ?DesignGenerationTaskEntity {
        if (
            $projectId !== $this->entity->getProjectId()
            || $assetType !== DesignGenerationAssetType::VIDEO
            || $generationId !== $this->entity->getGenerationId()
        ) {
            return null;
        }
        return $this->entity;
    }

    public function findByProjectAndOutputFilePath(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        DesignGenerationAssetType $assetType,
        string $relativeFilePath
    ): ?DesignGenerationTaskEntity {
        return null;
    }

    public function findProcessingTasksAfterId(int $cursorId, int $limit): array
    {
        return [];
    }
}
