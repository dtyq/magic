<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\KnowledgeBase;

use App\Application\File\Service\FileAppService;
use App\Application\KnowledgeBase\Port\EmbeddingProviderPort;
use App\Application\KnowledgeBase\Service\KnowledgeBaseAppService;
use App\Application\KnowledgeBase\Service\KnowledgeBaseDocumentAppService;
use App\Application\KnowledgeBase\Service\KnowledgeBaseFragmentAppService;
use App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase\KnowledgeBaseStrategyInterface;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\LLMAppService;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\KnowledgeBase\Facade\KnowledgeBaseApi;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\TestCase;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * @internal
 */
class KnowledgeBaseRebuildApiTest extends TestCase
{
    public function testRebuildAllowsOfficialOrganizationWithoutOfficialAdminMobile(): void
    {
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        $this->assertNotSame('', $officialOrganizationCode, 'official organization code must be configured');

        $payload = [
            'scope' => 'knowledge_base',
            'knowledge_organization_code' => 'DT001',
            'knowledge_base_code' => 'KNOWLEDGE-test',
            'target_model' => 'doubao-embedding-vision',
        ];

        $request = $this->createMock(RequestInterface::class);
        $request->expects($this->once())
            ->method('all')
            ->willReturn($payload);

        $authorization = new MagicUserAuthorization();
        $authorization->setOrganizationCode($officialOrganizationCode);
        $authorization->setMobile('');

        $knowledgeBaseAppService = $this->createMock(KnowledgeBaseAppService::class);
        $knowledgeBaseAppService->expects($this->once())
            ->method('rebuild')
            ->with($authorization, $payload)
            ->willReturn([
                'status' => 'accepted',
                'run_id' => 'r-test',
            ]);

        $api = $this->createApi($request, $knowledgeBaseAppService, $authorization);

        $this->assertSame([
            'code' => 1000,
            'message' => 'ok',
            'data' => [
                'status' => 'accepted',
                'run_id' => 'r-test',
            ],
        ], $api->rebuild());
    }

    public function testRebuildRejectsNonOfficialOrganization(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $request->expects($this->never())->method('all');

        $authorization = new MagicUserAuthorization();
        $authorization->setOrganizationCode('non-official-org');
        $authorization->setMobile('13800000000');

        $knowledgeBaseAppService = $this->createMock(KnowledgeBaseAppService::class);
        $knowledgeBaseAppService->expects($this->never())->method('rebuild');

        $api = $this->createApi($request, $knowledgeBaseAppService, $authorization);

        $response = $api->rebuild();
        $this->assertSame(UserErrorCode::ORGANIZATION_NOT_AUTHORIZE->value, $response['code'] ?? null);
    }

    private function createApi(
        RequestInterface $request,
        KnowledgeBaseAppService $knowledgeBaseAppService,
        MagicUserAuthorization $authorization,
    ): KnowledgeBaseApi {
        return new class($request, $knowledgeBaseAppService, $this->createMock(KnowledgeBaseDocumentAppService::class), $this->createMock(KnowledgeBaseFragmentAppService::class), $this->createMock(ModelGatewayMapper::class), $this->createMock(FileAppService::class), $this->createMock(KnowledgeBaseStrategyInterface::class), $this->createMock(LLMAppService::class), $this->createMock(EmbeddingProviderPort::class), $authorization) extends KnowledgeBaseApi {
            public function __construct(
                RequestInterface $request,
                KnowledgeBaseAppService $knowledgeBaseAppService,
                KnowledgeBaseDocumentAppService $knowledgeBaseDocumentAppService,
                KnowledgeBaseFragmentAppService $knowledgeBaseFragmentAppService,
                ModelGatewayMapper $modelGatewayMapper,
                FileAppService $fileAppService,
                KnowledgeBaseStrategyInterface $knowledgeBaseStrategy,
                LLMAppService $llmAppService,
                EmbeddingProviderPort $embeddingProviderPort,
                private readonly MagicUserAuthorization $authorization,
            ) {
                parent::__construct(
                    $request,
                    $knowledgeBaseAppService,
                    $knowledgeBaseDocumentAppService,
                    $knowledgeBaseFragmentAppService,
                    $modelGatewayMapper,
                    $fileAppService,
                    $knowledgeBaseStrategy,
                    $llmAppService,
                    $embeddingProviderPort,
                );
            }

            protected function getAuthorization(): Authenticatable
            {
                return $this->authorization;
            }
        };
    }
}
