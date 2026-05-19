<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Design\Assembler;

use App\Interfaces\Design\Assembler\ImageGenerationAssembler;
use App\Interfaces\Design\DTO\ImageGenerationDTO;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ImageGenerationAssemblerTest extends TestCase
{
    public function testToDOPassesImageGenerationConfig(): void
    {
        $dto = new ImageGenerationDTO();
        $dto->setProjectId('1');
        $dto->setImageId('img_1');
        $dto->setModelId('gpt-image-2');
        $dto->setFileDir('/workspace');
        $dto->setImageGenerationConfig([
            'quality' => 'high',
        ]);

        $entity = ImageGenerationAssembler::toDO($dto);

        $this->assertSame(['quality' => 'high'], $entity->getImageGenerationConfig());
    }
}
