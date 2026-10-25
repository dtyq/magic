<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Agent;

use App\Domain\SuperMagic\Agent\Entity\MagicClawEntity;
use App\Interfaces\SuperMagic\Agent\Assembler\MagicClawAssembler;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MagicClawAssemblerTest extends TestCase
{
    public function testToListItemContainsNeedUpgradeAsBool(): void
    {
        $entity = new MagicClawEntity();
        $entity->setId(1);
        $entity->setCode('MC-001');
        $entity->setName('Claw');
        $entity->setDescription('desc');
        $entity->setTemplateCode('openclaw');
        $entity->setProjectId(99);

        $result = MagicClawAssembler::toListItem($entity, 'Running', 888, true);

        $this->assertArrayHasKey('need_upgrade', $result);
        $this->assertIsBool($result['need_upgrade']);
        $this->assertTrue($result['need_upgrade']);
        $this->assertSame('888', $result['topic_id']);
    }

    public function testToListItemPreservesUnknownNeedUpgrade(): void
    {
        $entity = new MagicClawEntity();
        $entity->setId(1);
        $entity->setCode('MC-001');
        $entity->setName('Claw');
        $entity->setDescription('desc');
        $entity->setTemplateCode('openclaw');

        $result = MagicClawAssembler::toListItem($entity);

        $this->assertArrayHasKey('need_upgrade', $result);
        $this->assertNull($result['need_upgrade']);
    }
}
