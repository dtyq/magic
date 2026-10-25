<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Crontab;

use App\Application\ModelGateway\Crontab\ImageGenerationTaskTimeoutCrontab;
use App\Domain\ModelGateway\Entity\ImageGenerationTaskEntity;
use App\Domain\ModelGateway\Repository\ImageGenerationTaskRepositoryInterface;
use App\Domain\ModelGateway\Service\ImageGenerationPayloadSanitizer;
use App\Domain\ModelGateway\Service\ImageGenerationTaskDomainService;
use App\Infrastructure\Util\Locker\LockerInterface;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use RuntimeException;

/**
 * @internal
 */
class ImageGenerationTaskTimeoutCrontabTest extends TestCase
{
    private const string EXPECTED_LOCK_KEY = 'ImageGenerationTaskTimeoutCrontab:lock';

    public function testExecuteSweepsTimedOutTasksAndReleasesLock(): void
    {
        $repository = $this->createRepository([2]);
        $locker = $this->createLocker(true);
        $crontab = $this->createCrontab($repository, $locker);

        $crontab->execute();

        $this->assertCount(1, $repository->calls);
        $this->assertSame('IMAGE_GENERATION_FAILED', $repository->calls[0]['errorCode']);
        $this->assertSame([
            'acquire:' . self::EXPECTED_LOCK_KEY . ':300',
            'release:' . self::EXPECTED_LOCK_KEY,
        ], $locker->events);
    }

    public function testExecuteSkipsSweepingWhenLockIsHeld(): void
    {
        $repository = $this->createRepository([2]);
        $locker = $this->createLocker(false);
        $crontab = $this->createCrontab($repository, $locker);

        $crontab->execute();

        $this->assertSame([], $repository->calls);
        // 未拿到锁就不应该释放别人的锁
        $this->assertSame(['acquire:' . self::EXPECTED_LOCK_KEY . ':300'], $locker->events);
    }

    public function testExecuteReleasesLockEvenWhenSweepThrows(): void
    {
        $repository = $this->createThrowingRepository();
        $locker = $this->createLocker(true);
        $crontab = $this->createCrontab($repository, $locker);

        $crontab->execute();

        $this->assertSame([
            'acquire:' . self::EXPECTED_LOCK_KEY . ':300',
            'release:' . self::EXPECTED_LOCK_KEY,
        ], $locker->events);
    }

    /**
     * @param list<int> $affectedPerCall
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

    private function createThrowingRepository(): ImageGenerationTaskRepositoryInterface
    {
        return new class implements ImageGenerationTaskRepositoryInterface {
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
                throw new RuntimeException('sweep failed');
            }
        };
    }

    private function createLocker(bool $acquired): LockerInterface
    {
        return new class($acquired) implements LockerInterface {
            /** @var list<string> */
            public array $events = [];

            public function __construct(private bool $acquired)
            {
            }

            public function mutexLock(string $name, string $owner, int $expire = 180): bool
            {
                $this->events[] = "acquire:{$name}:{$expire}";
                return $this->acquired;
            }

            public function spinLock(string $name, string $owner, int $expire = 10, ?int $waitTimeout = null): bool
            {
                return false;
            }

            public function release(string $name, string $owner): bool
            {
                $this->events[] = "release:{$name}";
                return true;
            }
        };
    }

    private function createCrontab(
        ImageGenerationTaskRepositoryInterface $repository,
        LockerInterface $locker
    ): ImageGenerationTaskTimeoutCrontab {
        $crontab = new ImageGenerationTaskTimeoutCrontab(
            new ImageGenerationTaskDomainService($repository, new ImageGenerationPayloadSanitizer()),
            $locker
        );
        // HasLogger 通过 __get 懒加载 logger，这里注入 NullLogger 避免依赖容器。
        $crontab->logger = new NullLogger();

        return $crontab;
    }
}
