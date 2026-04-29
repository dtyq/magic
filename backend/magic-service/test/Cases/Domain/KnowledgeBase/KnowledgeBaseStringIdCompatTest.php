<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\KnowledgeBase;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseDocumentEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Interfaces\KnowledgeBase\DTO\KnowledgeBaseDocumentDTO;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class KnowledgeBaseStringIdCompatTest extends TestCase
{
    public function testDocumentEntityShouldAcceptStringIdsDuringHydration(): void
    {
        $entity = new KnowledgeBaseDocumentEntity([
            'id' => '123',
            'source_binding_id' => '456',
            'source_item_id' => '789',
        ]);

        $this->assertSame(123, $entity->getId());
        $this->assertSame(456, $entity->getSourceBindingId());
        $this->assertSame(789, $entity->getSourceItemId());
    }

    public function testDocumentEntityShouldClampNegativeStringBindingIds(): void
    {
        $entity = new KnowledgeBaseDocumentEntity([
            'source_binding_id' => '-1',
            'source_item_id' => '-2',
        ]);

        $this->assertSame(0, $entity->getSourceBindingId());
        $this->assertSame(0, $entity->getSourceItemId());
    }

    public function testFragmentEntityShouldAcceptStringId(): void
    {
        $entity = (new KnowledgeBaseFragmentEntity())->setId('123');

        $this->assertSame(123, $entity->getId());
    }

    public function testDocumentDTOShouldAcceptStringIdAndKeepNull(): void
    {
        $dto = new KnowledgeBaseDocumentDTO();

        $dto->setId('123');
        $this->assertSame(123, $dto->getId());

        $dto->setId(null);
        $this->assertNull($dto->getId());
    }
}
