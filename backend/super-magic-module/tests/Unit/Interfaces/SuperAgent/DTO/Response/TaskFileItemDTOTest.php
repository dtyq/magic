<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Interfaces\SuperAgent\DTO\Response;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class TaskFileItemDTOTest extends TestCase
{
    public function testFromEntityPreservesSource(): void
    {
        $entity = new TaskFileEntity();
        $entity->setFileId(1);
        $entity->setTaskId(2);
        $entity->setProjectId(3);
        $entity->setFileType('image');
        $entity->setFileName('demo.png');
        $entity->setFileExtension('png');
        $entity->setFileKey('/workspace/demo.png');
        $entity->setFileSize(128);
        $entity->setExternalUrl('https://example.com/demo.png');
        $entity->setTopicId(4);
        $entity->setParentId(5);
        $entity->setSort(6);
        $entity->setIsDirectory(false);
        $entity->setIsHidden(false);
        $entity->setUpdatedAt('2026-03-21 16:00:00');
        $entity->setSource(TaskFileSource::AI_VIDEO_GENERATION);

        $dto = TaskFileItemDTO::fromEntity($entity);

        $this->assertSame(TaskFileSource::AI_VIDEO_GENERATION, $dto->source);
    }

    public function testFromArraySupportsIntAndStringAiGeneratedValues(): void
    {
        $dtoFromInt = TaskFileItemDTO::fromArray([
            'file_id' => '1',
            'source' => 5,
        ]);
        $dtoFromString = TaskFileItemDTO::fromArray([
            'file_id' => '2',
            'source' => '7',
        ]);

        $this->assertSame(TaskFileSource::AI_IMAGE_GENERATION, $dtoFromInt->source);
        $this->assertSame(TaskFileSource::AI_VIDEO_GENERATION, $dtoFromString->source);
    }

    public function testFromArrayUsesDefaultWhenSourceIsMissing(): void
    {
        $dto = TaskFileItemDTO::fromArray([
            'file_id' => '1',
        ]);

        $this->assertSame(TaskFileSource::DEFAULT, $dto->source);
    }

    public function testFromArrayUsesDefaultForInvalidSourceValue(): void
    {
        $dto = TaskFileItemDTO::fromArray([
            'file_id' => '1',
            'source' => 'invalid',
        ]);

        $this->assertSame(TaskFileSource::DEFAULT, $dto->source);
    }

    public function testFromArrayUsesDefaultForNonScalarSource(): void
    {
        $dto = TaskFileItemDTO::fromArray([
            'file_id' => '1',
            'source' => ['invalid'],
        ]);

        $this->assertSame(TaskFileSource::DEFAULT, $dto->source);
    }
}
