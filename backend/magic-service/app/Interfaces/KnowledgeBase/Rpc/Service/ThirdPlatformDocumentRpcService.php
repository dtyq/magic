<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Rpc\Service;

use App\Application\Kernel\EnvManager;
use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\DocumentFileStrategy;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\AbstractDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ThirdPlatformDocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use Dtyq\MagicEnterprise\Application\Kernel\TeamshareMultipleEnvApiFactory;
use Dtyq\MagicEnterprise\Application\TeamshareOpenPlatform\Service\FIleOauth2AppService;
use Dtyq\MagicEnterprise\Application\TeamshareOpenPlatform\Service\Oauth2AuthenticationAppService;
use Dtyq\MagicEnterprise\Domain\TeamshareOpenPlatform\Entity\ValueObject\FileType;
use Dtyq\MagicEnterprise\Domain\TeamshareOpenPlatform\Entity\ValueObject\ThirdPartyPlatform;
use Dtyq\MagicEnterprise\Infrastructure\Core\DataIsolation\EnterpriseThirdPlatformDataIsolationManager;
use Dtyq\MagicEnterprise\Infrastructure\ExternalAPI\Teamshare\Oauth2\Teamshare\Api\Parameter\File\GetChildFilesParameter;
use Dtyq\MagicEnterprise\Infrastructure\ExternalAPI\Teamshare\Oauth2\Teamshare\Api\Parameter\Knowledge\GetManageableParameter;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_KNOWLEDGE_THIRD_PLATFORM_DOCUMENT)]
readonly class ThirdPlatformDocumentRpcService
{
    private const string SOURCE_KIND_RAW_CONTENT = 'raw_content';

    private const string SOURCE_KIND_DOWNLOAD_URL = 'download_url';

    public function __construct(
        private DocumentFileStrategy $documentFileStrategy,
        private FIleOauth2AppService $fileOauth2AppService,
        private Oauth2AuthenticationAppService $oauth2AuthenticationAppService,
        private TeamshareMultipleEnvApiFactory $teamshareMultipleEnvApiFactory,
        private LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_RESOLVE)]
    public function resolve(array $params): array
    {
        $dataIsolation = (array) ($params['data_isolation'] ?? []);
        $organizationCode = (string) ($dataIsolation['organization_code'] ?? '');
        $userId = (string) ($dataIsolation['user_id'] ?? '');

        $documentFilePayload = (array) ($params['document_file'] ?? []);
        $documentFilePayload['type'] = $documentFilePayload['type'] ?? 'third_platform';
        $documentFilePayload['platform_type'] = (string) (
            $documentFilePayload['platform_type']
            ?? $documentFilePayload['source_type']
            ?? $params['third_platform_type']
            ?? ''
        );
        $documentFilePayload['third_file_id'] = (string) (
            $documentFilePayload['third_file_id']
            ?? $documentFilePayload['third_id']
            ?? $params['third_file_id']
            ?? ''
        );

        if ($documentFilePayload['platform_type'] === '') {
            return [
                'code' => 400,
                'message' => 'document_file.platform_type is required for third_platform preview',
            ];
        }
        if ($documentFilePayload['third_file_id'] === '') {
            return [
                'code' => 400,
                'message' => 'document_file.third_file_id is required for third_platform preview',
            ];
        }

        try {
            $documentFile = AbstractDocumentFile::fromArray($documentFilePayload);
            if (! $documentFile instanceof ThirdPlatformDocumentFileInterface) {
                return [
                    'code' => 400,
                    'message' => 'document_file.type must be third_platform',
                ];
            }

            $isolation = $this->createKnowledgeBaseDataIsolation([
                'data_isolation' => [
                    'organization_code' => $organizationCode,
                    'user_id' => $userId,
                ],
            ]);
            $processedDocumentFile = $this->documentFileStrategy->preProcessDocumentFile($isolation, $documentFile);
            if (! $processedDocumentFile instanceof ThirdPlatformDocumentFileInterface) {
                return [
                    'code' => 500,
                    'message' => 'processed document_file.type is invalid',
                ];
            }
            $sourceDescriptor = $this->resolveDocumentSourceDescriptor($isolation, $processedDocumentFile);

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'source_kind' => $sourceDescriptor['source_kind'],
                    'raw_content' => $sourceDescriptor['raw_content'],
                    'download_url' => $sourceDescriptor['download_url'],
                    'content' => '',
                    'doc_type' => $processedDocumentFile->getDocType(),
                    'document_file' => $this->normalizeDocumentFilePayload($processedDocumentFile),
                ],
            ];
        } catch (Throwable $e) {
            $this->logger->error('IPC ThirdPlatformDocument resolve failed', [
                'error' => $e->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_EXPAND)]
    public function expand(array $params): array
    {
        $dataIsolation = (array) ($params['data_isolation'] ?? []);
        $organizationCode = (string) ($dataIsolation['organization_code'] ?? '');
        $userId = (string) ($dataIsolation['user_id'] ?? '');
        $documentFilesPayload = array_values(array_filter(
            array_map(static fn ($item) => is_array($item) ? $item : [], (array) ($params['document_files'] ?? [])),
            static fn (array $item): bool => $item !== []
        ));

        try {
            $documentFiles = array_map(static function (array $payload) {
                $payload['type'] = $payload['type'] ?? 'third_platform';
                $payload['platform_type'] = (string) ($payload['platform_type'] ?? $payload['source_type'] ?? '');
                $payload['third_file_id'] = (string) ($payload['third_file_id'] ?? $payload['third_id'] ?? '');
                return AbstractDocumentFile::fromArray($payload);
            }, $documentFilesPayload);

            $isolation = $this->createKnowledgeBaseDataIsolation([
                'data_isolation' => [
                    'organization_code' => $organizationCode,
                    'user_id' => $userId,
                ],
            ]);
            $expanded = $this->documentFileStrategy->preProcessDocumentFiles($isolation, $documentFiles);
            $result = [];
            foreach ($expanded as $documentFile) {
                if (! $documentFile instanceof ThirdPlatformDocumentFileInterface) {
                    continue;
                }
                $result[] = $this->normalizeDocumentFilePayload($documentFile);
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => $result,
            ];
        } catch (Throwable $e) {
            $this->logger->error('IPC ThirdPlatformDocument expand failed', [
                'error' => $e->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_LIST_KNOWLEDGE_BASES)]
    public function listKnowledgeBases(array $params): array
    {
        try {
            $dataIsolation = $this->createKnowledgeBaseDataIsolation($params);
            /** @var EnterpriseThirdPlatformDataIsolationManager $thirdPlatformManager */
            $thirdPlatformManager = $dataIsolation->getThirdPlatformDataIsolationManager();
            $teamshareApi = $this->teamshareMultipleEnvApiFactory->getByEnvId(
                $dataIsolation->getEnvId(),
                $thirdPlatformManager->getTeamshareConfigManager()
            );
            $accessToken = $this->oauth2AuthenticationAppService->getAccessToken(
                $dataIsolation,
                $dataIsolation->getCurrentUserId(),
                ThirdPartyPlatform::TeamshareOpenPlatformPro
            );
            $parameter = new GetManageableParameter($accessToken);
            $result = $teamshareApi->knowledge->getManageable($parameter);

            $items = [];
            foreach ($result->getKnowledgeList() as $knowledge) {
                $items[] = [
                    'knowledge_base_id' => $knowledge->getId(),
                    'name' => $knowledge->getName(),
                    'description' => $knowledge->getDescription(),
                ];
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => $items,
            ];
        } catch (Throwable $e) {
            $this->logger->error('IPC ThirdPlatformDocument listKnowledgeBases failed', [
                'error' => $e->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_LIST_TREE_NODES)]
    public function listTreeNodes(array $params): array
    {
        $parentType = (string) ($params['parent_type'] ?? '');
        $parentRef = (string) ($params['parent_ref'] ?? '');

        try {
            $dataIsolation = $this->createKnowledgeBaseDataIsolation($params);
            $knowledgeBaseId = $parentRef;

            if ($parentType === 'folder') {
                $parentFile = $this->fileOauth2AppService->getFile($dataIsolation, $parentRef)->getData();
                $knowledgeBaseId = (string) ($parentFile['knowledge_base_id'] ?? '');
            }

            $parameter = new GetChildFilesParameter('');
            $parameter->setParentId((int) $parentRef);
            $parameter->setPageSize(500);
            $children = $this->fileOauth2AppService->getChildFilesByParams($dataIsolation, $parameter)->getData();

            $items = [];
            foreach ($children as $child) {
                $childFileType = (int) ($child['file_type'] ?? FileType::UN_KNOW);
                $items[] = [
                    'knowledge_base_id' => (string) ($child['knowledge_base_id'] ?? $knowledgeBaseId),
                    'third_file_id' => (string) ($child['id'] ?? ''),
                    'parent_id' => (string) ($child['parent_id'] ?? $parentRef),
                    'name' => (string) ($child['name'] ?? ''),
                    'file_type' => (string) ($child['file_type'] ?? ''),
                    'extension' => (string) ($child['extension'] ?? ''),
                    'is_directory' => in_array($childFileType, [FileType::FOLDER, FileType::KNOWLEDGE_BASE], true),
                ];
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => $items,
            ];
        } catch (Throwable $e) {
            $this->logger->error('IPC ThirdPlatformDocument listTreeNodes failed', [
                'parent_type' => $parentType,
                'parent_ref' => $parentRef,
                'error' => $e->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $e->getMessage(),
            ];
        }
    }

    private function normalizeDocumentFilePayload(ThirdPlatformDocumentFileInterface $documentFile): array
    {
        $payload = [
            'type' => 'third_platform',
            'name' => $documentFile->getName(),
            'doc_type' => $documentFile->getDocType(),
            'source_type' => (string) $documentFile->getPlatformType(),
            'platform_type' => (string) $documentFile->getPlatformType(),
            'third_id' => (string) $documentFile->getThirdFileId(),
            'third_file_id' => (string) $documentFile->getThirdFileId(),
            'url' => '',
            'size' => 0,
            'extension' => '',
        ];

        if (method_exists($documentFile, 'getThirdFileType')) {
            $payload['third_file_type'] = (string) $documentFile->getThirdFileType();
        }
        if (method_exists($documentFile, 'getThirdFileExtensionName')) {
            $payload['third_file_extension_name'] = (string) $documentFile->getThirdFileExtensionName();
            $payload['extension'] = (string) $documentFile->getThirdFileExtensionName();
        }
        if (method_exists($documentFile, 'getKnowledgeBaseId')) {
            $payload['knowledge_base_id'] = $documentFile->getKnowledgeBaseId();
        }

        return $payload;
    }

    /**
     * @return array{source_kind: string, raw_content: string, download_url: string}
     */
    private function resolveDocumentSourceDescriptor(
        KnowledgeBaseDataIsolation $dataIsolation,
        ThirdPlatformDocumentFileInterface $documentFile,
    ): array {
        $fileType = method_exists($documentFile, 'getThirdFileType') ? (int) $documentFile->getThirdFileType() : null;
        $directContentFileTypes = array_flip([
            FileType::CLOUD_DOCUMENT,
            FileType::OLD_CLOUD_DOCUMENT,
            FileType::MULTI_TABLE,
        ]);

        if (isset($directContentFileTypes[$fileType])) {
            $rawContent = (string) ($this->fileOauth2AppService->getFileMarkdown($dataIsolation, $documentFile->getThirdFileId())->getData()['content'] ?? '');
            if ($fileType === FileType::MULTI_TABLE) {
                $rawContent = $this->convertMarkdownTableToCsv($rawContent);
                $this->overrideResolvedDocumentExtension($documentFile, 'csv');
            } else {
                $this->overrideResolvedDocumentExtension($documentFile, 'md');
            }

            return [
                'source_kind' => self::SOURCE_KIND_RAW_CONTENT,
                'raw_content' => $rawContent,
                'download_url' => '',
            ];
        }

        $downloadURL = (string) ($this->fileOauth2AppService->getTeamshareFileDownloadUrls($dataIsolation, [$documentFile->getThirdFileId()])->getData()[0]['url'] ?? '');
        $this->overrideResolvedDocumentExtension($documentFile, (string) ($this->normalizeDocumentFilePayload($documentFile)['extension'] ?? ''));

        return [
            'source_kind' => self::SOURCE_KIND_DOWNLOAD_URL,
            'raw_content' => '',
            'download_url' => $downloadURL,
        ];
    }

    private function overrideResolvedDocumentExtension(ThirdPlatformDocumentFileInterface $documentFile, string $extension): void
    {
        if ($extension === '' || ! method_exists($documentFile, 'setThirdFileExtensionName')) {
            return;
        }
        $documentFile->setThirdFileExtensionName($extension);
    }

    private function convertMarkdownTableToCsv(string $markdownContent): string
    {
        if ($markdownContent === '') {
            return '';
        }

        $lines = explode("\n", $markdownContent);
        $csvLines = [];
        $inTable = false;
        $tableHeaders = [];
        $isFirstTableRow = true;
        $isSecondTableRow = false;

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                if ($inTable) {
                    $inTable = false;
                    $csvLines[] = '';
                }
                continue;
            }
            if (str_starts_with($line, '## ')) {
                if ($inTable) {
                    $inTable = false;
                    $csvLines[] = '';
                }
                $isFirstTableRow = true;
                $isSecondTableRow = false;
                continue;
            }
            if (! str_starts_with($line, '|')) {
                continue;
            }

            $inTable = true;
            if ($isFirstTableRow) {
                $cells = array_map('trim', explode('|', trim($line, '| ')));
                $tableHeaders = array_filter($cells);
                $isFirstTableRow = false;
                $isSecondTableRow = true;
                continue;
            }
            if ($isSecondTableRow) {
                $isSecondTableRow = false;
                continue;
            }

            $cells = array_values(array_filter(array_map('trim', explode('|', trim($line, '| '))), static fn ($cell) => $cell !== ''));
            $cells = array_map(function ($cell, $index) use ($tableHeaders) {
                $header = $tableHeaders[$index] ?? '';
                $value = $header !== '' ? $header . ': ' . $cell : $cell;
                if (str_contains($value, ',') || str_contains($value, '"') || str_contains($value, "\n") || str_contains($value, "\r")) {
                    return '"' . str_replace('"', '""', $value) . '"';
                }
                return $value;
            }, $cells, array_keys($cells));
            $csvLines[] = implode(',', $cells);
        }

        return implode("\n", $csvLines);
    }

    private function createKnowledgeBaseDataIsolation(array $params): KnowledgeBaseDataIsolation
    {
        $dataIsolation = (array) ($params['data_isolation'] ?? []);
        $userId = (string) ($dataIsolation['user_id'] ?? '');
        $knowledgeBaseDataIsolation = KnowledgeBaseDataIsolation::create(
            (string) ($dataIsolation['organization_code'] ?? ''),
            $userId,
            EnvManager::getMagicId($userId) ?? ''
        );
        EnvManager::initDataIsolationEnv($knowledgeBaseDataIsolation);
        return $knowledgeBaseDataIsolation;
    }
}
