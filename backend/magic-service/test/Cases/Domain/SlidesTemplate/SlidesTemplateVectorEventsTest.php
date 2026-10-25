<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SlidesTemplate;

use App\Domain\SlidesTemplate\Event\SlidesTemplateBatchReindexRequestedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateCreatedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateDeletedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateStatusUpdatedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateUpdatedEvent;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class SlidesTemplateVectorEventsTest extends TestCase
{
    public function testSlidesTemplateEventsExposeExpectedFields(): void
    {
        $event = new SlidesTemplateCreatedEvent('template-1', 'ORG001', 'user-1');

        self::assertSame('template-1', $event->slidesTemplateId);
        self::assertSame('ORG001', $event->organizationCode);
        self::assertSame('user-1', $event->operatorId);
        self::assertSame(['slidesTemplateId', 'organizationCode', 'operatorId'], array_keys(get_object_vars($event)));

        $updated = new SlidesTemplateUpdatedEvent('template-1', 'ORG001', 'user-1');
        $deleted = new SlidesTemplateDeletedEvent('template-1', 'ORG001', 'user-1');
        $batchReindexRequested = new SlidesTemplateBatchReindexRequestedEvent(['template-1', 'template-2'], 'ORG001', 'user-1');
        $statusUpdated = new SlidesTemplateStatusUpdatedEvent('template-1', 'ORG001', 'user-1', 1);

        self::assertSame('template-1', $updated->slidesTemplateId);
        self::assertSame('template-1', $deleted->slidesTemplateId);
        self::assertSame(['template-1', 'template-2'], $batchReindexRequested->slidesTemplateIds);
        self::assertSame('template-1', $statusUpdated->slidesTemplateId);
        self::assertSame(1, $statusUpdated->status);
        self::assertSame(
            ['slidesTemplateId', 'organizationCode', 'operatorId', 'status'],
            array_keys(get_object_vars($statusUpdated)),
        );
    }
}
