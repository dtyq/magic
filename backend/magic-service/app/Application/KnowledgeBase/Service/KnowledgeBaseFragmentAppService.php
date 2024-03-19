<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityFilter;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityManager;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\FragmentConfig;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeRetrievalResult;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseFragmentQuery;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use App\Interfaces\KnowledgeBase\Assembler\KnowledgeBaseFragmentAssembler;
use App\Interfaces\KnowledgeBase\DTO\KnowledgeBaseFragmentDTO;
use Exception;
use Qbhy\HyperfAuth\Authenticatable;

class KnowledgeBaseFragmentAppService extends AbstractKnowledgeAppService
{
    public function save(Authenticatable $authorization, KnowledgeBaseFragmentEntity $savingMagicFlowKnowledgeFragmentEntity): KnowledgeBaseFragmentEntity
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'w', $savingMagicFlowKnowledgeFragmentEntity->getKnowledgeCode(), $savingMagicFlowKnowledgeFragmentEntity->getDocumentCode());
        $savingMagicFlowKnowledgeFragmentEntity->setCreator($dataIsolation->getCurrentUserId());
        $knowledgeBaseDocumentEntity = $this->knowledgeBaseDocumentDomainService->show($dataIsolation, $savingMagicFlowKnowledgeFragmentEntity->getKnowledgeCode(), $savingMagicFlowKnowledgeFragmentEntity->getDocumentCode());
        $knowledgeBaseEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $savingMagicFlowKnowledgeFragmentEntity->getKnowledgeCode());
        return $this->knowledgeBaseFragmentDomainService->save($dataIsolation, $knowledgeBaseEntity, $knowledgeBaseDocumentEntity, $savingMagicFlowKnowledgeFragmentEntity);
    }

    /**
     * @return array{total: int, list: array<KnowledgeBaseFragmentEntity>}
     */
    public function queries(Authenticatable $authorization, KnowledgeBaseFragmentQuery $query, Page $page): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'r', $query->getKnowledgeCode(), $query->getDocumentCode());
        $knowledgeBaseEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $query->getKnowledgeCode());
        if ($knowledgeBaseEntity->getDefaultDocumentCode() === $query->getDocumentCode()) {
            $query->setIsDefaultDocumentCode(true);
        }
        if (! $query->getVersion()) {
            $knowledgeBaseDocumentEntity = $this->knowledgeBaseDocumentDomainService->show($dataIsolation, $query->getKnowledgeCode(), $query->getDocumentCode());
            $query->setVersion($knowledgeBaseDocumentEntity->getVersion());
        }

        return $this->knowledgeBaseFragmentDomainService->queries($dataIsolation, $query, $page);
    }

    public function show(Authenticatable $authorization, string $knowledgeBaseCode, string $documentCode, int $id): KnowledgeBaseFragmentEntity
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'r', $knowledgeBaseCode, $documentCode, $id);
        return $this->knowledgeBaseFragmentDomainService->show($dataIsolation, $id);
    }

    public function destroy(Authenticatable $authorization, string $knowledgeBaseCode, string $documentCode, int $id): void
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'del', $knowledgeBaseCode, $documentCode, $id);
        $knowledgeBaseEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $knowledgeBaseCode);
        $oldEntity = $this->knowledgeBaseFragmentDomainService->show($dataIsolation, $id);
        $this->knowledgeBaseFragmentDomainService->destroy($dataIsolation, $knowledgeBaseEntity, $oldEntity);
    }

    public function destroyByMetadataFilter(Authenticatable $authorization, string $knowledgeBaseCode, array $metadataFilter): void
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'del', $knowledgeBaseCode);
        $knowledgeBaseEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $knowledgeBaseCode);

        $filter = new KnowledgeSimilarityFilter();
        $filter->setKnowledgeCodes([$knowledgeBaseCode]);
        $filter->setMetadataFilter($metadataFilter);
        di(KnowledgeSimilarityManager::class)->destroyByMetadataFilter($dataIsolation, $knowledgeBaseEntity, $filter);
    }

    /**
     * @return array<KnowledgeBaseFragmentEntity>
     * @throws Exception|SSRFException
     */
    public function fragmentPreview(Authenticatable $authorization, DocumentFileInterface $documentFile, FragmentConfig $fragmentConfig): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $documentFile = $this->documentFileStrategy->preProcessDocumentFile($dataIsolation, $documentFile);
        $content = $this->documentFileStrategy->parseContent($dataIsolation, $documentFile);
        $fragmentContents = $this->knowledgeBaseFragmentDomainService->processFragmentsByContent($dataIsolation, $content, $fragmentConfig);
        return KnowledgeBaseFragmentEntity::fromFragmentContents($fragmentContents);
    }

    /**
     * @return array<KnowledgeBaseFragmentDTO>
     */
    public function similarity(Authenticatable $authenticatable, string $knowledgeBaseCode, string $query): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authenticatable);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'r', $knowledgeBaseCode);
        $knowledgeBaseEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $knowledgeBaseCode);
        $retrieveConfig = $knowledgeBaseEntity->getRetrieveConfig();
        $filter = new KnowledgeSimilarityFilter();
        $filter->setQuery($query);
        $filter->setKnowledgeCodes([$knowledgeBaseCode]);
        $filter->setLimit($retrieveConfig->getTopK());
        $filter->setScore($retrieveConfig->getScoreThreshold());
        $result = $this->knowledgeSimilarityManager->similarity($dataIsolation, $filter, $knowledgeBaseEntity->getRetrieveConfig());
        /** @var array<string, KnowledgeRetrievalResult> $result */
        $result = array_column($result, null, 'id');
        $fragmentIds = array_column($result, 'id');
        $fragmentEntities = $this->knowledgeBaseFragmentDomainService->getByIds($dataIsolation, $fragmentIds);
        $documentCodes = array_column($fragmentEntities, 'document_code');
        $documentCodeEntityMap = $this->knowledgeBaseDocumentDomainService->getDocumentsByCodes($dataIsolation, $knowledgeBaseCode, $documentCodes);
        $dtoList = array_map(fn (KnowledgeBaseFragmentEntity $entity) => KnowledgeBaseFragmentAssembler::entityToDTO($entity), $fragmentEntities);
        foreach ($dtoList as $dto) {
            $documentEntity = $documentCodeEntityMap[$dto->getDocumentCode()];
            $dto->setScore($result[(string) $dto->getId()]->getScore())
                ->setDocumentName($documentEntity->getName())
                ->setDocumentType($documentEntity->getDocType());
        }
        return $dtoList;
    }
}
