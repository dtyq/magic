<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Interfaces\SlidesTemplate;

use App\Interfaces\SlidesTemplate\DTO\Request\PublicQuerySlidesTemplateRequest;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class PublicQuerySlidesTemplateRequestTest extends TestCase
{
    public function testSearchTypeDefaultsToVector(): void
    {
        $request = new class extends PublicQuerySlidesTemplateRequest {
            public function __construct()
            {
            }

            public function input($key = null, $default = null): mixed
            {
                return $default;
            }
        };

        self::assertSame('vector', $request->getSearchType());
    }

    public function testSearchTypeReadsVectorValue(): void
    {
        $request = new class extends PublicQuerySlidesTemplateRequest {
            public function __construct()
            {
            }

            public function input($key = null, $default = null): mixed
            {
                return $key === 'search_type' ? 'vector' : $default;
            }
        };

        self::assertSame('vector', $request->getSearchType());
    }

    public function testSearchTypeReadsDatabaseValue(): void
    {
        $request = $this->request(['search_type' => 'database']);

        self::assertSame('database', $request->getSearchType());
    }

    public function testInvalidSearchTypeFallsBackToVector(): void
    {
        $request = $this->request(['search_type' => 'hybrid']);

        self::assertSame('vector', $request->getSearchType());
    }

    public function testTagCodesNormalizeCommaSeparatedAndDuplicateValues(): void
    {
        $request = $this->request(['tag_codes' => ' featured, blue,featured, ']);

        self::assertSame(['featured', 'blue'], $request->getTagCodes());
    }

    public function testTagCodesNormalizeArrayValues(): void
    {
        $request = $this->request(['tag_codes' => ['featured', ' ', 'blue', 'featured', 1]]);

        self::assertSame(['featured', 'blue'], $request->getTagCodes());
    }

    public function testPublicSearchDefaultsAreStable(): void
    {
        $request = $this->request();

        self::assertSame('official', $request->getScope());
        self::assertSame(1, $request->getPage());
        self::assertSame(20, $request->getPageSize());
        self::assertNull($request->getKeyword());
        self::assertSame('any', $request->getTagMatch());
        self::assertSame([], $request->getTagCodes());
        self::assertSame('', $request->getToken());
    }

    public function testTokenIsTrimmed(): void
    {
        self::assertSame('share-token', $this->request(['token' => ' share-token '])->getToken());
    }

    public function testWhitespaceKeywordAndCodeValuesBecomeNull(): void
    {
        $request = $this->request([
            'keyword' => '  ',
            'code' => '  ',
            'category_code' => '  ',
        ]);

        self::assertNull($request->getKeyword());
        self::assertNull($request->getCode());
        self::assertNull($request->getCategoryCode());
    }

    public function testInvalidTagMatchFallsBackToAny(): void
    {
        self::assertSame('any', $this->request(['tag_match' => 'invalid'])->getTagMatch());
    }

    /** @param array<string, mixed> $input */
    private function request(array $input = []): PublicQuerySlidesTemplateRequest
    {
        return new class($input) extends PublicQuerySlidesTemplateRequest {
            /** @param array<string, mixed> $input */
            public function __construct(private readonly array $input)
            {
            }

            public function input($key = null, $default = null): mixed
            {
                return $key === null ? $this->input : ($this->input[$key] ?? $default);
            }
        };
    }
}
