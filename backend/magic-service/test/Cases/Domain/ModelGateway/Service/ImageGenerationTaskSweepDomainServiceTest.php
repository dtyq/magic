<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ImageGenerationTaskEntity;
use App\Domain\ModelGateway\Repository\ImageGenerationTaskRepositoryInterface;
use App\Domain\ModelGateway\Service\ImageGenerationPayloadSanitizer;
use App\Domain\ModelGateway\Service\ImageGenerationTaskDomainService;
use PHPUnit\Framework\TestCase;

use function Hyperf\Translation\__;

/**
 * @internal
 */
class ImageGenerationTaskSweepDomainServiceTest extends TestCase
{
    public function testSweepUsesThirtyMinuteCutoffAndFriendlyErrorMessage(): void
    {
        $repository = $this->createRepository([3]);
        $service = new ImageGenerationTaskDomainService($repository, new ImageGenerationPayloadSanitizer());

        $swept = $service->sweepTimedOutTasks();

        $this->assertSame(3, $swept);
        $this->assertCount(1, $repository->calls);

        $call = $repository->calls[0];
        $this->assertSame('IMAGE_GENERATION_FAILED', $call['errorCode']);
        $this->assertSame((string) __('image_generate.task_failed_retry'), $call['errorMessage']);
        $this->assertSame(500, $call['limit']);

        $cutoff = strtotime($call['createdBefore']);
        $this->assertNotFalse($cutoff);
        $this->assertEqualsWithDelta(
            time() - 1800,
            $cutoff,
            5
        );
    }

    public function testSweepStopsOnceBatchIsNotFull(): void
    {
        // 第一批跑满 2 行（继续），第二批只命中 1 行（说明已清扫干净，停止）。
        $repository = $this->createRepository([2, 1]);
        $service = new ImageGenerationTaskDomainService($repository, new ImageGenerationPayloadSanitizer());

        $swept = $service->sweepTimedOutTasks(2, 10);

        $this->assertSame(3, $swept);
        $this->assertCount(2, $repository->calls);
    }

    public function testSweepStopsAtMaxBatches(): void
    {
        $repository = $this->createRepository([2, 2, 2, 2]);
        $service = new ImageGenerationTaskDomainService($repository, new ImageGenerationPayloadSanitizer());

        $swept = $service->sweepTimedOutTasks(2, 3);

        $this->assertSame(6, $swept);
        $this->assertCount(3, $repository->calls);
    }

    public function testSweepReturnsZeroWhenNothingToSweep(): void
    {
        $repository = $this->createRepository([0]);
        $service = new ImageGenerationTaskDomainService($repository, new ImageGenerationPayloadSanitizer());

        $this->assertSame(0, $service->sweepTimedOutTasks());
        $this->assertCount(1, $repository->calls);
    }

    /**
     * 超时文案会原样返回给用户，语言包里缺 key 会退化成裸 key，这里直接读语言包兜底校验。
     */
    public function testTimeoutMessageKeyExistsInLanguagePacks(): void
    {
        foreach (['zh_CN', 'en_US'] as $locale) {
            $messages = require BASE_PATH . "/storage/languages/{$locale}/image_generate.php";

            $this->assertArrayHasKey('task_failed_retry', $messages, "missing task_failed_retry in {$locale}");
            $this->assertNotSame('', $messages['task_failed_retry'], "empty task_failed_retry in {$locale}");
            $this->assertNotSame('task_failed_retry', $messages['task_failed_retry'], "untranslated task_failed_retry in {$locale}");
        }
    }

    /**
     * @param list<int> $affectedPerCall 每次批量更新返回的影响行数
     */
    private function createRepository(array $affectedPerCall): ImageGenerationTaskRepositoryInterface
    {
        return new class($affectedPerCall) implements ImageGenerationTaskRepositoryInterface {
            /** @var list<array{createdBefore: string, errorCode: string, errorMessage: string, limit: int}> */
            public array $calls = [];

            /**
             * @param list<int> $affectedPerCall
             */
            public function __construct(private array $affectedPerCall)
            {
            }

            public function getById(string $id): ?ImageGenerationTaskEntity
            {
                return null;
            }

            public function save(ImageGenerationTaskEntity $entity): void
            {
            }

            public function markTimedOutBatch(
                string $createdBefore,
                string $errorCode,
                string $errorMessage,
                int $limit
            ): int {
                $this->calls[] = [
                    'createdBefore' => $createdBefore,
                    'errorCode' => $errorCode,
                    'errorMessage' => $errorMessage,
                    'limit' => $limit,
                ];

                return array_shift($this->affectedPerCall) ?? 0;
            }
        };
    }
}
