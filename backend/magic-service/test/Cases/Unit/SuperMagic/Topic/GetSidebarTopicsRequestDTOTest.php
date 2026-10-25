<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\SuperMagic\Topic;

use App\Interfaces\SuperMagic\Topic\DTO\Request\GetSidebarTopicsRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\TestCase;

/** @internal */
final class GetSidebarTopicsRequestDTOTest extends TestCase
{
    public function testTypesAreParsedWithoutChangingSearchOrPagination(): void
    {
        foreach ([['', []], ['1', [1]], ['2', [2]], ['1,2,1', [1, 2]], [1, [1]], [2, [2]]] as [$input, $expected]) {
            $request = $this->createMock(RequestInterface::class);
            $request->method('route')->willReturn(42);
            $request->method('input')->willReturnCallback(static fn ($key, $default = null) => [
                'topic_types' => $input,
                'q' => ' report ',
                'page' => 2,
                'page_size' => 10,
            ][$key] ?? $default);
            $dto = GetSidebarTopicsRequestDTO::fromRequest($request);
            self::assertSame($expected, $dto->getTopicTypes());
            self::assertSame(42, $dto->getProjectId());
            self::assertSame('report', $dto->getQ());
            self::assertSame(2, $dto->getPage());
            self::assertSame(10, $dto->getPageSize());
        }
    }
}
