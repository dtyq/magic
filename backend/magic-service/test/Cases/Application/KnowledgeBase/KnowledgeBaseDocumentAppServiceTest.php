<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\KnowledgeBase;

use App\Application\KnowledgeBase\Port\FragmentHttpPassthroughPort;
use App\Application\KnowledgeBase\Service\KnowledgeBaseDocumentAppService;
use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\DocumentFileStrategy;
use App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase\KnowledgeBaseStrategyInterface;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityManager;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Port\DocumentGateway;
use App\Domain\KnowledgeBase\Port\FragmentGateway;
use App\Domain\KnowledgeBase\Port\KnowledgeBaseGateway;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseDocumentRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseFragmentRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseRepositoryInterface;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDocumentDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseFragmentDomainService;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\File\Parser\FileParser;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Psr\SimpleCache\CacheInterface;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * @internal
 */
class KnowledgeBaseDocumentAppServiceTest extends TestCase
{
    public function testReVectorizedWithoutSyncFlagDoesNotPollDocumentStatus(): void
    {
        $documentGateway = $this->createMock(DocumentGateway::class);
        $documentGateway->expects($this->once())
            ->method('show')
            ->willReturn($this->documentPayload(2));
        $documentGateway->expects($this->once())
            ->method('sync')
            ->willReturn(true);

        $this->newService($documentGateway)->reVectorized(
            $this->createMock(Authenticatable::class),
            'KB-1',
            'DOC-1',
        );
    }

    public function testReVectorizedWithSyncFlagWaitsUntilStatusChanged(): void
    {
        $documentGateway = $this->createMock(DocumentGateway::class);
        $documentGateway->expects($this->exactly(2))
            ->method('show')
            ->willReturnOnConsecutiveCalls(
                $this->documentPayload(2),
                $this->documentPayload(3),
            );
        $documentGateway->expects($this->once())
            ->method('sync')
            ->willReturn(true);

        $this->newService($documentGateway)->reVectorized(
            $this->createMock(Authenticatable::class),
            'KB-1',
            'DOC-1',
            ['sync' => 'true'],
        );
    }

    public function testReVectorizedWithoutDocumentFileKeepsOriginalFailure(): void
    {
        $documentGateway = $this->createMock(DocumentGateway::class);
        $documentGateway->expects($this->once())
            ->method('show')
            ->willReturn($this->documentPayload(2, false));
        $documentGateway->expects($this->never())
            ->method('sync');

        $this->expectException(BusinessException::class);

        $this->newService($documentGateway)->reVectorized(
            $this->createMock(Authenticatable::class),
            'KB-1',
            'DOC-1',
            ['sync' => true],
        );
    }

    private function newService(DocumentGateway $documentGateway): KnowledgeBaseDocumentAppService
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        return new class($this->createMock(MagicUserDomainService::class), $this->createMock(OperationPermissionAppService::class), new KnowledgeBaseDomainService($this->createMock(KnowledgeBaseRepositoryInterface::class), $this->createMock(KnowledgeBaseFragmentRepositoryInterface::class), $this->createMock(CacheInterface::class)), new KnowledgeBaseDocumentDomainService($this->createMock(KnowledgeBaseDocumentRepositoryInterface::class)), new KnowledgeBaseFragmentDomainService($this->createMock(KnowledgeBaseFragmentRepositoryInterface::class), $this->createMock(KnowledgeBaseRepositoryInterface::class), $this->createMock(KnowledgeBaseDocumentRepositoryInterface::class), $loggerFactory), new FileDomainService($this->createMock(CloudFileRepositoryInterface::class)), $this->createMock(AdminProviderDomainService::class), $this->createMock(FileParser::class), $this->createMock(KnowledgeSimilarityManager::class), $this->createMock(DocumentFileStrategy::class), $this->createMock(KnowledgeBaseStrategyInterface::class), $this->createMock(KnowledgeBaseGateway::class), $documentGateway, $this->createMock(FragmentGateway::class), $this->createMock(FragmentHttpPassthroughPort::class), $loggerFactory, KnowledgeBaseDataIsolation::create('ORG-1', 'U1')) extends KnowledgeBaseDocumentAppService {
            public function __construct(
                MagicUserDomainService $magicUserDomainService,
                OperationPermissionAppService $operationPermissionAppService,
                KnowledgeBaseDomainService $knowledgeBaseDomainService,
                KnowledgeBaseDocumentDomainService $knowledgeBaseDocumentDomainService,
                KnowledgeBaseFragmentDomainService $knowledgeBaseFragmentDomainService,
                FileDomainService $fileDomainService,
                AdminProviderDomainService $serviceProviderDomainService,
                FileParser $fileParser,
                KnowledgeSimilarityManager $knowledgeSimilarityManager,
                DocumentFileStrategy $documentFileStrategy,
                KnowledgeBaseStrategyInterface $knowledgeBaseStrategy,
                KnowledgeBaseGateway $knowledgeBaseAppClient,
                DocumentGateway $documentAppClient,
                FragmentGateway $fragmentAppClient,
                FragmentHttpPassthroughPort $fragmentHttpPassthroughClient,
                LoggerFactory $loggerFactory,
                private readonly KnowledgeBaseDataIsolation $dataIsolation,
            ) {
                parent::__construct(
                    $magicUserDomainService,
                    $operationPermissionAppService,
                    $knowledgeBaseDomainService,
                    $knowledgeBaseDocumentDomainService,
                    $knowledgeBaseFragmentDomainService,
                    $fileDomainService,
                    $serviceProviderDomainService,
                    $fileParser,
                    $knowledgeSimilarityManager,
                    $documentFileStrategy,
                    $knowledgeBaseStrategy,
                    $knowledgeBaseAppClient,
                    $documentAppClient,
                    $fragmentAppClient,
                    $fragmentHttpPassthroughClient,
                    $loggerFactory,
                );
            }

            protected function createKnowledgeBaseDataIsolation(Authenticatable|BaseDataIsolation $authorization): KnowledgeBaseDataIsolation
            {
                return $this->dataIsolation;
            }
        };
    }

    private function documentPayload(int $syncStatus, bool $withDocumentFile = true): array
    {
        return [
            'organization_code' => 'ORG-1',
            'knowledge_base_code' => 'KB-1',
            'code' => 'DOC-1',
            'name' => 'demo.md',
            'sync_status' => $syncStatus,
            'document_file' => $withDocumentFile ? $this->createMock(DocumentFileInterface::class) : null,
        ];
    }
}
