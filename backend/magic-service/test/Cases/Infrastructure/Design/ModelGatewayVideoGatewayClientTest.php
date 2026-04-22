<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Design;

use App\Application\ModelGateway\Service\VideoOperationAppService;
use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use App\Domain\ModelGateway\Entity\Dto\VideoOperationResponseDTO;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Design\ModelGatewayVideoGatewayClient;
use PHPUnit\Framework\TestCase;
use stdClass;

/**
 * @internal
 */
class ModelGatewayVideoGatewayClientTest extends TestCase
{
    protected function setUp(): void
    {
        if ($this->name() === 'testSubmitVideoThrowsBusinessExceptionWhenAccessTokenNotConfigured') {
            return;
        }

        if (! defined('MAGIC_ACCESS_TOKEN')) {
            define('MAGIC_ACCESS_TOKEN', 'magic-access-token-for-test');
        }
    }

    public function testSubmitVideoReturnsProviderTaskIdFromOperationResponse(): void
    {
        $response = new VideoOperationResponseDTO();
        $response->setId('op_123');
        $response->setProviderTaskId('provider_task_123');
        $response->setStatus('queued');

        $capture = new stdClass();
        $capture->value = null;
        $videoOperationAppService = new readonly class($response, $capture) extends VideoOperationAppService {
            public function __construct(
                private VideoOperationResponseDTO $response,
                private stdClass $capture,
            ) {
            }

            public function enqueue(string $accessToken, CreateVideoDTO $requestDTO): VideoOperationResponseDTO
            {
                $this->capture->value = [$accessToken, $requestDTO];

                return $this->response;
            }
        };

        $client = new ModelGatewayVideoGatewayClient($videoOperationAppService);

        $result = $client->submitVideo([
            'prompt' => 'make a video',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'task' => 'generate',
            'inputs' => [],
            'generation' => [],
            'callbacks' => [],
            'execution' => [],
            'extensions' => [],
            'business_params' => [
                'project_id' => 1001,
                'video_id' => 'video-123',
                'source_id' => 'design_video_generation',
            ],
        ], [
            'organization_code' => 'org',
            'user_id' => 'user-1',
        ]);

        $this->assertSame([
            'id' => 'op_123',
            'provider_task_id' => 'provider_task_123',
            'provider' => '',
            'status' => 'queued',
        ], $result);
        $this->assertSame('magic-access-token-for-test', $capture->value[0]);
        $this->assertInstanceOf(CreateVideoDTO::class, $capture->value[1]);
    }

    public function testSubmitVideoPropagatesProviderBusinessException(): void
    {
        $videoOperationAppService = new readonly class extends VideoOperationAppService {
            public function __construct()
            {
            }

            public function enqueue(string $accessToken, CreateVideoDTO $requestDTO): VideoOperationResponseDTO
            {
                throw new BusinessException('provider rejected request', 14001);
            }
        };

        $client = new ModelGatewayVideoGatewayClient($videoOperationAppService);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(14001);
        $this->expectExceptionMessage('provider rejected request');

        $client->submitVideo([
            'prompt' => 'make a video',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'task' => 'generate',
            'inputs' => [],
            'generation' => [],
            'callbacks' => [],
            'execution' => [],
            'extensions' => [],
        ], [
            'organization_code' => 'org',
            'user_id' => 'user-1',
        ]);
    }
}
