<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Design\Factory;

use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Factory\DesignGenerationTaskFactory;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class DesignGenerationTaskFactoryTest extends TestCase
{
    public function testCreateVideoTaskKeepsInputModeAndFramesInPayloads(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-1',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在喝水',
            'file_dir' => '/2121/videos/',
            'input_mode' => 'keyframe_guided',
            'inputs' => [
                'frames' => [
                    ['role' => 'start', 'uri' => '/2121/images/start.jpg'],
                ],
            ],
        ]);
        $dto->valid();

        $entity = DesignGenerationTaskFactory::createVideoTask($dto);

        $this->assertSame('keyframe_guided', $entity->getRequestPayload()['input_mode']);
        $this->assertSame('/2121/images/start.jpg', $entity->getRequestPayload()['inputs']['frames'][0]['uri']);
        $this->assertSame('/2121/images/start.jpg', $entity->getInputPayload()['frames'][0]['uri']);
        $this->assertArrayNotHasKey('video', $entity->getRequestPayload()['inputs']);
        $this->assertArrayNotHasKey('video', $entity->getInputPayload());
    }
}
