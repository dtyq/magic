<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Mode\Service;

use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Application\Mode\Service\ModeAppService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

/**
 * @internal
 */
class ModeAppServiceGroupsCacheTest extends TestCase
{
    public function testSameDtoIsSerializedOnlyOnce(): void
    {
        $dto = $this->createCountingDto([['id' => 'g1']]);
        $cache = [];

        $first = $this->invoke($dto, $cache);
        $second = $this->invoke($dto, $cache);
        $third = $this->invoke($dto, $cache);

        $this->assertSame(1, $dto->toArrayCalls);
        $this->assertSame([['id' => 'g1']], $first);
        $this->assertSame($first, $second);
        $this->assertSame($first, $third);
    }

    public function testDifferentDtosAreCachedIndependently(): void
    {
        $dtoA = $this->createCountingDto([['id' => 'a']]);
        $dtoB = $this->createCountingDto([['id' => 'b']]);
        $cache = [];

        $this->assertSame([['id' => 'a']], $this->invoke($dtoA, $cache));
        $this->assertSame([['id' => 'b']], $this->invoke($dtoB, $cache));
        $this->assertSame([['id' => 'a']], $this->invoke($dtoA, $cache));
        $this->assertSame([['id' => 'b']], $this->invoke($dtoB, $cache));

        $this->assertSame(1, $dtoA->toArrayCalls);
        $this->assertSame(1, $dtoB->toArrayCalls);
        $this->assertCount(2, $cache);
    }

    public function testMissingGroupsFallsBackToEmptyArrayAndIsCached(): void
    {
        $dto = $this->createCountingDto(null);
        $cache = [];

        $this->assertSame([], $this->invoke($dto, $cache));
        $this->assertSame([], $this->invoke($dto, $cache));
        $this->assertSame(1, $dto->toArrayCalls);
    }

    public function testEmptyGroupsResultIsCachedInsteadOfRecomputed(): void
    {
        $dto = $this->createCountingDto([]);
        $cache = [];

        $this->invoke($dto, $cache);
        $this->invoke($dto, $cache);

        $this->assertSame(1, $dto->toArrayCalls);
    }

    public function testCacheIsScopedToTheCallerProvidedArray(): void
    {
        $dto = $this->createCountingDto([['id' => 'g1']]);
        $cacheOne = [];
        $cacheTwo = [];

        $this->invoke($dto, $cacheOne);
        $this->invoke($dto, $cacheTwo);

        $this->assertSame(2, $dto->toArrayCalls);
    }

    private function invoke(ModeAggregateDTO $dto, array &$cache): array
    {
        $service = (new ReflectionClass(ModeAppService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(ModeAppService::class, 'getGroupsArrayCached');
        $args = [$dto, &$cache];

        return $method->invokeArgs($service, $args);
    }

    private function createCountingDto(?array $groups): ModeAggregateDTO
    {
        return new class($groups) extends ModeAggregateDTO {
            public int $toArrayCalls = 0;

            public function __construct(private readonly ?array $fakeGroups)
            {
            }

            public function toArray(): array
            {
                ++$this->toArrayCalls;
                return $this->fakeGroups === null ? [] : ['groups' => $this->fakeGroups];
            }
        };
    }
}
