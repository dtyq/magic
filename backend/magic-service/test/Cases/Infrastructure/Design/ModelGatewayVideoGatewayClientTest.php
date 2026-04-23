<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Design;

use App\Application\ModelGateway\Component\Points\DTO\PointEstimateResult;
use App\Application\ModelGateway\Service\VideoOperationAppService;
use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use App\Domain\ModelGateway\Entity\Dto\VideoOperationResponseDTO;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Design\ModelGatewayVideoGatewayClient;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use stdClass;

/**
 * @internal
 */
class ModelGatewayVideoGatewayClientTest extends TestCase
{
    protected function setUp(): void
    {
        if (! ApplicationContext::hasContainer()) {
            ApplicationContext::setContainer(new class implements ContainerInterface {
                public function get(string $id): mixed
                {
                    return null;
                }

                public function has(string $id): bool
                {
                    return false;
                }
            });
        }

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
        $this->assertIsArray($capture->value);
        [$accessToken, $requestDTO] = $capture->value;
        $this->assertSame('magic-access-token-for-test', $accessToken);
        $this->assertInstanceOf(CreateVideoDTO::class, $requestDTO);
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

    public function testEstimateVideoPassesMergedBusinessParamsToOperationService(): void
    {
        $response = new PointEstimateResult('video', 180, [
            'mode' => 'token',
            'billable_tokens' => 90000,
        ]);

        $capture = new stdClass();
        $capture->value = null;
        $videoOperationAppService = new readonly class($response, $capture) extends VideoOperationAppService {
            public function __construct(
                private PointEstimateResult $response,
                private stdClass $capture,
            ) {
            }

            public function estimate(string $accessToken, CreateVideoDTO $requestDTO): PointEstimateResult
            {
                $this->capture->value = [$accessToken, $requestDTO];

                return $this->response;
            }
        };

        $client = new ModelGatewayVideoGatewayClient($videoOperationAppService);

        $result = $client->estimateVideo([
            'prompt' => 'make a video',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'task' => 'generate',
            'inputs' => [],
            'generation' => [
                'resolution' => '480p',
                'duration_seconds' => 4,
            ],
            'callbacks' => [],
            'execution' => [],
            'extensions' => [],
            'business_params' => [
                'project_id' => 1001,
                'source_id' => 'design_video_generation',
            ],
        ], [
            'organization_code' => 'org',
            'user_id' => 'user-1',
        ]);

        $this->assertSame([
            'resource_type' => 'video',
            'points' => 180,
            'detail' => [
                'mode' => 'token',
                'billable_tokens' => 90000,
            ],
        ], $result);
        $this->assertIsArray($capture->value);
        [$accessToken, $requestDTO] = $capture->value;
        $this->assertSame('magic-access-token-for-test', $accessToken);
        $this->assertInstanceOf(CreateVideoDTO::class, $requestDTO);
        $this->assertSame('org', $requestDTO->getBusinessParam('organization_code'));
        $this->assertSame('user-1', $requestDTO->getBusinessParam('user_id'));
        $this->assertSame(1001, $requestDTO->getProjectId());
    }
}
