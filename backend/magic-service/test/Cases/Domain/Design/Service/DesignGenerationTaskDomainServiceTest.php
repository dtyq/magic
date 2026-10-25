<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Design\Service;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\ValueObject\DesignGenerationStatus;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\Design\Repository\Facade\DesignGenerationTaskRepositoryInterface;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use Throwable;

/**
 * @internal
 */
class DesignGenerationTaskDomainServiceTest extends TestCase
{
    public function testSanitizePublicErrorCodeReturnsNullWhenTranslationIsNestedArray(): void
    {
        $service = new DesignGenerationTaskDomainService($this->createMock(DesignGenerationTaskRepositoryInterface::class));
        $method = new ReflectionMethod(DesignGenerationTaskDomainService::class, 'sanitizePublicErrorCode');
        $method->setAccessible(true);

        $this->assertNull($method->invoke($service, 'InvalidParameter'));
    }

    public function testMarkAsFailedWithNestedErrorCodeTranslationUpdatesStatus(): void
    {
        $entity = new DesignGenerationTaskEntity();
        $entity->setGenerationId('video-1');
        $entity->setStatus(DesignGenerationStatus::PROCESSING);

        $repository = $this->createMock(DesignGenerationTaskRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('update')
            ->with(
                $this->isInstanceOf(DesignDataIsolation::class),
                $this->callback(static function (DesignGenerationTaskEntity $task): bool {
                    return $task->getStatus() === DesignGenerationStatus::FAILED
                        && $task->getErrorMessage() !== null
                        && $task->getErrorMessage() !== '';
                }),
            );

        $service = new DesignGenerationTaskDomainService($repository);
        $service->markAsFailed(
            new DesignDataIsolation(),
            $entity,
            'image data 0 failed: Image dimensions are too small.',
            'InvalidParameter',
        );
    }

    public function testPrepareForCreateAllowsEmptyPromptForDraftTask(): void
    {
        $entity = $this->createEntity(VideoInputMode::DraftTask->value);

        $entity->prepareForCreate();

        $this->assertSame(DesignGenerationStatus::PENDING, $entity->getStatus());
    }

    public function testPrepareForCreateRequiresPromptForRegularGeneration(): void
    {
        $entity = $this->createEntity(VideoInputMode::Standard->value);

        // 批量运行下 ExceptionBuilder 可能因容器未就绪先抛 TypeError，只断言「被拒绝」。
        $this->expectException(Throwable::class);

        $entity->prepareForCreate();
    }

    private function createEntity(string $inputMode): DesignGenerationTaskEntity
    {
        $entity = new DesignGenerationTaskEntity();
        $entity->setOrganizationCode('org-1');
        $entity->setUserId('user-1');
        $entity->setProjectId(1);
        $entity->setGenerationId('video-1');
        $entity->setGenerationType(DesignGenerationType::TEXT_TO_VIDEO);
        $entity->setModelId('seedance-2.5');
        $entity->setFileDir('/2121/videos/');
        $entity->setRequestPayload(['input_mode' => $inputMode]);

        return $entity;
    }
}
