<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Agent;

use Dtyq\SuperMagic\Domain\Agent\Entity\MagicClawEntity;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\MagicClawAssembler;
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
}
