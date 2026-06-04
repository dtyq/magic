<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\KnowledgeBase;

use App\Application\KnowledgeBase\DTO\FragmentRequestDTO;
use App\Application\KnowledgeBase\Service\AbstractKnowledgeAppService;
use App\Application\KnowledgeBase\Service\KnowledgeBaseFragmentAppService;
use App\Domain\KnowledgeBase\Port\FragmentGateway;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\Context;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionProperty;

/**
 * @internal
 */
class KnowledgeBaseFragmentAppServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Context::destroy('LastBaseDataIsolationInitEnv');

        parent::tearDown();
    }

    public function testFlowVectorSimilarityByUserRawShouldUseExplicitOrganizationCodeInIpcContext(): void
    {
        Context::set('LastBaseDataIsolationInitEnv', new BaseDataIsolation('AUTH-ORG', 'api-key-relation-user'));

        $fragmentGateway = $this->createMock(FragmentGateway::class);
        $fragmentGateway->expects($this->once())
            ->method('flowVectorSimilarityByUser')
            ->with($this->callback(static function (FragmentRequestDTO $request): bool {
                return $request->magicUserId === 'MAGIC-U1'
                    && $request->queryText === 'keyword'
                    && $request->topK === 3
                    && (float) $request->scoreThreshold === 0.0
                    && $request->dataIsolation->organizationCode === 'DT001'
                    && $request->dataIsolation->userId === 'MAGIC-U1'
                    && $request->businessParams?->organizationCode === 'DT001'
                    && $request->businessParams?->userId === 'MAGIC-U1';
            }))
            ->willReturn(['page' => 1, 'total' => 0, 'list' => []]);

        $authorization = (new MagicUserAuthorization())
            ->setId('api-key-relation-user')
            ->setOrganizationCode('AUTH-ORG');

        $result = $this->newService($fragmentGateway)->flowVectorSimilarityByUserRaw(
            $authorization,
            'MAGIC-U1',
            'keyword',
            3,
            0.0,
            'DT001',
        );

        $this->assertSame(['page' => 1, 'total' => 0, 'list' => []], $result);
    }

    private function newService(FragmentGateway $fragmentGateway): KnowledgeBaseFragmentAppService
    {
        $service = (new ReflectionClass(KnowledgeBaseFragmentAppService::class))->newInstanceWithoutConstructor();
        $fragmentAppClient = new ReflectionProperty(AbstractKnowledgeAppService::class, 'fragmentAppClient');
        $fragmentAppClient->setValue($service, $fragmentGateway);

        return $service;
    }
}
