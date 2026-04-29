<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\KnowledgeBase;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use DateTime;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class KnowledgeBaseEntityInitializationTest extends TestCase
{
    public function testSafeDefaultsDoNotTriggerTypedPropertyError(): void
    {
        $entity = new KnowledgeBaseEntity();

        $this->assertSame('', $entity->getCreator());
        $this->assertSame('', $entity->getModifier());
        $this->assertInstanceOf(DateTime::class, $entity->getCreatedAt());
        $this->assertInstanceOf(DateTime::class, $entity->getUpdatedAt());
    }

    public function testStringIdShouldBeAcceptedDuringHydration(): void
    {
        $entity = new KnowledgeBaseEntity([
            'id' => '123',
        ]);

        $this->assertSame(123, $entity->getId());
    }
}
