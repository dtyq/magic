<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\KnowledgeBase\Port\FragmentHttpPassthroughPort;
use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\DocumentFileStrategy;
use App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase\KnowledgeBaseStrategyInterface;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityManager;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\KnowledgeBase\Port\DocumentGateway;
use App\Domain\KnowledgeBase\Port\FragmentGateway;
use App\Domain\KnowledgeBase\Port\KnowledgeBaseGateway;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDocumentDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseFragmentDomainService;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Infrastructure\Core\File\Parser\FileParser;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

abstract class AbstractKnowledgeAppService extends AbstractKernelAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected readonly MagicUserDomainService $magicUserDomainService,
        protected readonly OperationPermissionAppService $operationPermissionAppService,
        protected readonly KnowledgeBaseDomainService $knowledgeBaseDomainService,
        protected readonly KnowledgeBaseDocumentDomainService $knowledgeBaseDocumentDomainService,
        protected readonly KnowledgeBaseFragmentDomainService $knowledgeBaseFragmentDomainService,
        protected readonly FileDomainService $fileDomainService,
        protected readonly AdminProviderDomainService $serviceProviderDomainService,
        protected readonly FileParser $fileParser,
        protected readonly KnowledgeSimilarityManager $knowledgeSimilarityManager,
        protected readonly DocumentFileStrategy $documentFileStrategy,
        protected readonly KnowledgeBaseStrategyInterface $knowledgeBaseStrategy,
        protected readonly KnowledgeBaseGateway $knowledgeBaseAppClient,
        protected readonly DocumentGateway $documentAppClient,
        protected readonly FragmentGateway $fragmentAppClient,
        protected readonly FragmentHttpPassthroughPort $fragmentHttpPassthroughClient,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }
}
