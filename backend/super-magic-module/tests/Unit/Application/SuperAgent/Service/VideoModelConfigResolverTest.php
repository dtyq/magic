<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use Dtyq\SuperMagic\Application\SuperAgent\Service\VideoModelConfigResolver;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * @internal
 */
final class VideoModelConfigResolverTest extends TestCase
{
    public function testCreatesModelGatewayDataIsolationFromContactDataIsolation(): void
    {
        $contactDataIsolation = DataIsolation::create('ORG001', 'user-1');
        $contactDataIsolation->setCurrentMagicId('magic-1');

        $resolver = new VideoModelConfigResolver();
        $reflection = new ReflectionClass($resolver);
        $method = $reflection->getMethod('createModelGatewayDataIsolation');
        $method->setAccessible(true);

        $modelGatewayDataIsolation = $method->invoke($resolver, $contactDataIsolation);

        $this->assertInstanceOf(ModelGatewayDataIsolation::class, $modelGatewayDataIsolation);
        $this->assertSame('ORG001', $modelGatewayDataIsolation->getCurrentOrganizationCode());
        $this->assertSame('user-1', $modelGatewayDataIsolation->getCurrentUserId());
        $this->assertSame('magic-1', $modelGatewayDataIsolation->getMagicId());
    }

    public function testKeepsExistingVideoGenerationConfig(): void
    {
        $resolver = new VideoModelConfigResolver();

        $videoModel = $resolver->resolve([
            'model_id' => ' kling-v3-omni ',
            'video_generation_config' => [
                'input_modes' => [
                    'standard' => ['task' => 'generate'],
                ],
            ],
        ]);

        $this->assertSame('kling-v3-omni', $videoModel['model_id']);
        $this->assertSame('generate', $videoModel['video_generation_config']['input_modes']['standard']['task']);
    }
}
