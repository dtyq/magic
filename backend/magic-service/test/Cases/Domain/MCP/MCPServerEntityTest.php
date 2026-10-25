<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\MCP;

use App\Domain\MCP\Entity\MCPServerEntity;
use App\Infrastructure\Core\Exception\BusinessException;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class MCPServerEntityTest extends BaseTest
{
    public function testPrepareForCreationAcceptsMaxDescriptionLength(): void
    {
        $entity = $this->createValidServerEntity();
        $entity->setDescription(str_repeat('测', MCPServerEntity::DESCRIPTION_MAX_LENGTH));

        $entity->prepareForCreation();

        $this->assertSame(MCPServerEntity::DESCRIPTION_MAX_LENGTH, mb_strlen($entity->getDescription()));
    }

    public function testPrepareForCreationRejectsOversizedDescription(): void
    {
        $entity = $this->createValidServerEntity();
        $entity->setDescription(str_repeat('测', MCPServerEntity::DESCRIPTION_MAX_LENGTH + 1));

        $this->expectException(BusinessException::class);
        $entity->prepareForCreation();
    }

    public function testPrepareForModificationRejectsOversizedDescription(): void
    {
        $savingEntity = $this->createValidServerEntity();
        $savingEntity->setDescription(str_repeat('a', MCPServerEntity::DESCRIPTION_MAX_LENGTH + 1));

        $existingEntity = $this->createValidServerEntity();
        $existingEntity->prepareForCreation();

        $this->expectException(BusinessException::class);
        $savingEntity->prepareForModification($existingEntity);
    }

    public function testPrepareForCreationRejectsOversizedName(): void
    {
        $entity = $this->createValidServerEntity();
        $entity->setName(str_repeat('名', MCPServerEntity::NAME_MAX_LENGTH + 1));

        $this->expectException(BusinessException::class);
        $entity->prepareForCreation();
    }

    public function testPrepareForCreationRejectsOversizedIcon(): void
    {
        $entity = $this->createValidServerEntity();
        $entity->setIcon(str_repeat('i', MCPServerEntity::ICON_MAX_LENGTH + 1));

        $this->expectException(BusinessException::class);
        $entity->prepareForCreation();
    }

    private function createValidServerEntity(): MCPServerEntity
    {
        $entity = new MCPServerEntity();
        $entity->setOrganizationCode('ORG001');
        $entity->setName('发票查验');
        $entity->setCreator('user-1');
        $entity->setDescription('支持增值税发票在线查验');

        return $entity;
    }
}
