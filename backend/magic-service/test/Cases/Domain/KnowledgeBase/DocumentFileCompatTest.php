<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\KnowledgeBase;

use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\AbstractDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ExternalDocumentFile;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\AbstractDocumentFileDTO;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\ExternalDocumentFileDTO;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class DocumentFileCompatTest extends TestCase
{
    public function testVOFromArrayShouldFallbackKeyFromUrl(): void
    {
        $documentFile = AbstractDocumentFile::fromArray([
            'type' => 1,
            'name' => 'demo.md',
            'url' => 'DT001/open/demo.md',
        ]);

        $this->assertInstanceOf(ExternalDocumentFile::class, $documentFile);
        $this->assertSame('DT001/open/demo.md', $documentFile->getKey());
    }

    public function testDTOFromArrayShouldFallbackKeyFromUrl(): void
    {
        $documentFile = AbstractDocumentFileDTO::fromArray([
            'type' => 1,
            'name' => 'demo.md',
            'url' => 'DT001/open/demo.md',
        ]);

        $this->assertInstanceOf(ExternalDocumentFileDTO::class, $documentFile);
        $this->assertSame('DT001/open/demo.md', $documentFile->getKey());
    }
}
