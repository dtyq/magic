<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Service;

use App\Application\Design\Service\DesignVideoAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

/**
 * @internal
 */
class DesignVideoAppServiceBusinessParamsTest extends TestCase
{
    public function testPrepareGatewayPayloadWithBusinessParamsMovesContextFields(): void
    {
        $service = (new ReflectionClass(DesignVideoAppService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(DesignVideoAppService::class, 'prepareGatewayPayloadWithBusinessParams');
        $method->setAccessible(true);

        $payload = $method->invoke(
            $service,
            $this->buildDesignDataIsolation(),
            [
                'model_id' => 'video-model',
                'topic_id' => 'topic-001',
                'task_id' => 'task-001',
            ],
            123,
            'video-001',
        );

        $this->assertIsArray($payload);
        $businessParams = $payload['business_params'];

        $this->assertArrayNotHasKey('topic_id', $payload);
        $this->assertArrayNotHasKey('task_id', $payload);
        $this->assertSame($businessParams, $payload['business_params']);
        $this->assertSame('org-code', $businessParams['organization_code']);
        $this->assertSame('user-id', $businessParams['user_id']);
        $this->assertSame(123, $businessParams['project_id']);
        $this->assertSame('video-001', $businessParams['video_id']);
        $this->assertSame('design_video_generation', $businessParams['source_id']);
        $this->assertSame('topic-001', $businessParams['magic_topic_id']);
        $this->assertSame('task-001', $businessParams['magic_task_id']);
    }

    private function buildDesignDataIsolation(): DesignDataIsolation
    {
        return new class extends DesignDataIsolation {
            public function __construct()
            {
            }

            public function getCurrentOrganizationCode(): string
            {
                return 'org-code';
            }

            public function getCurrentUserId(): string
            {
                return 'user-id';
            }
        };
    }
}
