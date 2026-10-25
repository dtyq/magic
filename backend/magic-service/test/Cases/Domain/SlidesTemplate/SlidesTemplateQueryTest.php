<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\SlidesTemplate;

use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateSearchType;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class SlidesTemplateQueryTest extends TestCase
{
    public function testSearchTypeDefaultsToDatabase(): void
    {
        self::assertSame(SlidesTemplateSearchType::Database, (new SlidesTemplateQuery())->getSearchType());
    }

    public function testSearchTypeCanSwitchToVector(): void
    {
        $query = new SlidesTemplateQuery();
        $query->setSearchType('vector');

        self::assertSame(SlidesTemplateSearchType::Vector, $query->getSearchType());
    }
}
