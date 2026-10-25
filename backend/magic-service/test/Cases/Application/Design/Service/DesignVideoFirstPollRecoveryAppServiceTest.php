<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Service;

use App\Application\Design\Event\Publish\DesignVideoSubmitPublisher;
use App\Application\Design\Service\DesignVideoFirstPollRecoveryAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ValueObject\DesignGenerationAssetType;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\Design\Factory\DesignGenerationTaskFactory;
use App\Domain\Design\Repository\Facade\DesignGenerationTaskRepositoryInterface;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use Hyperf\Amqp\Producer;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class DesignVideoFirstPollRecoveryAppServiceTest extends TestCase
{
    public function testCanvasCompositionWithoutOperationIdRecoversSubmissionMessage(): void
    {
        $entity = $this->createPendingCanvasCompositionEntity();
        $repository = new RecoveryInMemoryDesignVideoTaskRepository($entity);
        $producer = $this->createMock(Producer::class);
        $producer->expects($this->once())
            ->method('produce')
            ->with($this->isInstanceOf(DesignVideoSubmitPublisher::class));

        $service = new DesignVideoFirstPollRecoveryAppService(
            new DesignGenerationTaskDomainService($repository),
            $producer,
            $this->createMock(LoggerInterface::class),
        );

        $service->recover();

        $this->assertSame('sent', $entity->getFirstPollStatus());
        $this->assertSame(1, $repository->updateCount);
    }

    /** 创建尚未提交到沙箱的画布合成任务。 */
    private function createPendingCanvasCompositionEntity(): DesignGenerationTaskEntity
    {
        $entity = DesignGenerationTaskFactory::createVideoTask(new DesignVideoCreateDTO([
            'project_id' => 123,
            'video_id' => 'composition-recovery-1',
            'generation_type' => DesignGenerationType::CANVAS_COMPOSITION->value,
            'topic_id' => '456',
            'extensions' => [
                'project_path' => 'canvas-project',
                'video_edit_element_id' => 'video-edit-1',
            ],
        ]));
        $entity->setOrganizationCode('org');
        $entity->setUserId('user-1');
        $entity->prepareForCreate();
        $entity->setId(1001);

        return $entity;
    }
}

/** 为恢复服务测试提供待处理任务。 */
class RecoveryInMemoryDesignVideoTaskRepository implements DesignGenerationTaskRepositoryInterface
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
        return null;
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
        if (($this->entity->getId() ?? 0) <= $cursorId) {
            return [];
        }

        return [$this->entity];
    }
}
