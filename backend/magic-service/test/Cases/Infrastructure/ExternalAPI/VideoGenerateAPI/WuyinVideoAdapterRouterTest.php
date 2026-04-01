<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinGrokVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinVideoClient;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class WuyinVideoAdapterRouterTest extends TestCase
{
    public function testRouterResolvesVeoAndGrokFamiliesByModel(): void
    {
        $router = $this->createRouter();

        $veoConfig = $router->resolveGenerationConfig('veo3.1_fast', 'wuyin-veo-3.1-fast-generate-preview');
        $grokConfig = $router->resolveGenerationConfig('grok_imagine', 'wuyin-grok-imagine');

        $this->assertNotNull($veoConfig);
        $this->assertNotNull($grokConfig);
        $this->assertSame(['text_prompt', 'image', 'last_frame'], $veoConfig->toArray()['supported_inputs']);
        $this->assertSame(['text_prompt', 'reference_images'], $grokConfig->toArray()['supported_inputs']);
    }

    public function testRouterBuildsPayloadUsingMatchedGrokAdapter(): void
    {
        $router = $this->createRouter();
        $operation = new VideoQueueOperationEntity(
            id: 'op-router-1',
            endpoint: 'video:wuyin-grok-imagine',
            model: 'wuyin-grok-imagine',
            modelVersion: 'grok_imagine',
            providerModelId: 'provider-model-grok',
            providerCode: 'Wuyin',
            providerName: 'wuyin',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'make a grok video',
                'inputs' => [
                    'reference_images' => [
                        ['uri' => 'https://example.com/ref.png'],
                    ],
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $router->buildProviderPayload($operation);

        $this->assertSame([
            'prompt' => 'make a grok video',
            'image_urls' => ['https://example.com/ref.png'],
        ], $payload);
    }

    public function testRouterStillSupportsLegacyModelIdsForHistoricalOperations(): void
    {
        $router = $this->createRouter();

        $this->assertNotNull($router->resolveGenerationConfig('veo3.1_fast', 'veo-3.1-fast-generate-preview'));
        $this->assertNotNull($router->resolveGenerationConfig('grok_imagine', 'grok-imagine'));
    }

    private function createRouter(): WuyinVideoAdapterRouter
    {
        $client = new WuyinVideoClient($this->createMock(ClientFactory::class));

        return new WuyinVideoAdapterRouter(
            new WuyinVeoVideoAdapter($client),
            new WuyinGrokVideoAdapter($client),
        );
    }
}
