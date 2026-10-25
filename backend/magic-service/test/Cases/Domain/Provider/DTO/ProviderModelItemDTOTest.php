<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Provider\DTO;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\Provider\DTO\ProviderModelItemDTO;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ProviderModelItemDTOTest extends TestCase
{
    public function testVideoGenerationConfigIsSerializedAsNullableField(): void
    {
        $config = new VideoGenerationConfig([
            'supported_inputs' => ['text_prompt'],
        ]);
        $dto = new ProviderModelItemDTO();

        $dto->setVideoGenerationConfig($config);

        $this->assertSame($config, $dto->getVideoGenerationConfig());
        $this->assertSame($config->toArray(), $dto->toArray()['video_generation_config']);
    }
}
