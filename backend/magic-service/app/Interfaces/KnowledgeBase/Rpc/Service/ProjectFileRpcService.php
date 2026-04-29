<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Rpc\Service;

use App\Application\Kernel\Proxy\FileParserProxy;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocType;
use App\Infrastructure\Core\File\Parser\FileParser;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_KNOWLEDGE_PROJECT_FILE)]
readonly class ProjectFileRpcService
{
    public function __construct(
        private TaskFileDomainService $taskFileDomainService,
        private ProjectDomainService $projectDomainService,
        private WorkspaceDomainService $workspaceDomainService,
        private FileParserProxy $fileParserProxy,
        private LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_RESOLVE)]
    public function resolve(array $params): array
    {
        $projectFileId = (int) ($params['project_file_id'] ?? 0);
        if ($projectFileId <= 0) {
            return [
                'code' => 400,
                'message' => 'project_file_id is required',
            ];
        }

        try {
            $fileEntity = $this->taskFileDomainService->getById($projectFileId);
            if ($fileEntity === null) {
                return [
                    'code' => 0,
                    'message' => 'success',
                    'data' => [
                        'status' => 'deleted',
                        'project_file_id' => $projectFileId,
                    ],
                ];
            }

            $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());
            if ($projectEntity === null) {
                return [
                    'code' => 404,
                    'message' => 'project not found',
                ];
            }

            $workDir = $projectEntity->getWorkDir();
            $documentFile = $this->buildDocumentFilePayload($fileEntity, $workDir);
            $content = '';
            if (! $fileEntity->getIsDirectory()) {
                if (! FileParser::supportsExtension($fileEntity->getFileExtension())) {
                    return [
                        'code' => 0,
                        'message' => 'success',
                        'data' => $this->buildResolvePayload($fileEntity, $documentFile, 'unsupported', ''),
                    ];
                }
                $url = $this->taskFileDomainService->getFilePreSignedUrl($fileEntity->getOrganizationCode(), $fileEntity);
                $content = $this->fileParserProxy->parse($url, true);
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => $this->buildResolvePayload($fileEntity, $documentFile, 'active', $content),
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC ProjectFile resolve failed', [
                'project_file_id' => $projectFileId,
                'error' => $throwable->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_LIST_BY_PROJECT)]
    public function listByProject(array $params): array
    {
        $projectId = (int) ($params['project_id'] ?? 0);
        if ($projectId <= 0) {
            return [
                'code' => 400,
                'message' => 'project_id is required',
            ];
        }

        try {
            $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
            if ($projectEntity === null) {
                return [
                    'code' => 404,
                    'message' => 'project not found',
                ];
            }

            $rootFile = $this->taskFileDomainService->getRootFile($projectId);
            if ($rootFile === null) {
                return [
                    'code' => 0,
                    'message' => 'success',
                    'data' => [],
                ];
            }

            $files = $this->taskFileDomainService->findFilesRecursivelyByParentId($projectId, $rootFile->getFileId());
            $items = [];
            foreach ($files as $fileEntity) {
                if ($fileEntity->getIsDirectory()) {
                    continue;
                }
                $items[] = $this->buildListItem($fileEntity, $projectEntity->getWorkDir());
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => $items,
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC ProjectFile listByProject failed', [
                'project_id' => $projectId,
                'error' => $throwable->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_LIST_WORKSPACES)]
    public function listWorkspaces(array $params): array
    {
        try {
            $limit = max(1, (int) ($params['limit'] ?? 20));
            $offset = max(0, (int) ($params['offset'] ?? 0));
            $page = (int) floor($offset / $limit) + 1;
            $dataIsolation = $this->createDataIsolation($params);
            $result = $this->workspaceDomainService->getWorkspacesByConditions(
                [],
                $page,
                $limit,
                'id',
                'desc',
                $dataIsolation
            );

            $items = [];
            foreach ($result['list'] ?? [] as $workspaceEntity) {
                $items[] = [
                    'workspace_id' => $workspaceEntity->getId(),
                    'workspace_name' => $workspaceEntity->getName(),
                    'description' => '',
                ];
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'total' => (int) ($result['total'] ?? count($items)),
                    'list' => $items,
                ],
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC ProjectFile listWorkspaces failed', [
                'error' => $throwable->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_LIST_PROJECTS)]
    public function listProjects(array $params): array
    {
        $workspaceId = (int) ($params['workspace_id'] ?? 0);

        try {
            $limit = max(1, (int) ($params['limit'] ?? 20));
            $offset = max(0, (int) ($params['offset'] ?? 0));
            $page = (int) floor($offset / $limit) + 1;
            $dataIsolation = $this->createDataIsolation($params);
            $result = $this->projectDomainService->getProjectsByConditions(
                [
                    'workspace_id' => $workspaceId,
                    'user_id' => $dataIsolation->getCurrentUserId(),
                    'user_organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                    'is_hidden' => 0,
                ],
                $page,
                $limit
            );

            $items = [];
            foreach ($result['list'] ?? [] as $projectEntity) {
                $items[] = [
                    'workspace_id' => $projectEntity->getWorkspaceId(),
                    'project_id' => $projectEntity->getId(),
                    'project_name' => $projectEntity->getProjectName(),
                    'description' => '',
                    'workspace_ref' => (string) $projectEntity->getWorkspaceId(),
                ];
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'total' => (int) ($result['total'] ?? count($items)),
                    'list' => $items,
                ],
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC ProjectFile listProjects failed', [
                'workspace_id' => $workspaceId,
                'error' => $throwable->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_LIST_TREE_NODES)]
    public function listTreeNodes(array $params): array
    {
        $parentType = (string) ($params['parent_type'] ?? '');
        $parentRef = (int) ($params['parent_ref'] ?? 0);

        try {
            if ($parentType === 'project') {
                $projectEntity = $this->projectDomainService->getProjectNotUserId($parentRef);
                $rootFile = $this->taskFileDomainService->getRootFile($parentRef);
                if ($projectEntity === null || $rootFile === null) {
                    return [
                        'code' => 0,
                        'message' => 'success',
                        'data' => [],
                    ];
                }
                $parentId = $rootFile->getFileId();
            } else {
                $parentFile = $this->taskFileDomainService->getById($parentRef);
                if ($parentFile === null) {
                    return [
                        'code' => 0,
                        'message' => 'success',
                        'data' => [],
                    ];
                }
                $projectEntity = $this->projectDomainService->getProjectNotUserId($parentFile->getProjectId());
                $parentId = $parentFile->getFileId();
            }

            if ($projectEntity === null) {
                return [
                    'code' => 0,
                    'message' => 'success',
                    'data' => [],
                ];
            }

            $children = $this->taskFileDomainService->getChildrenByParentAndProject(
                $projectEntity->getId(),
                $parentId,
                1000
            );

            $items = [];
            foreach ($children as $fileEntity) {
                $items[] = $this->buildTreeNodeItem($fileEntity, $projectEntity->getWorkDir());
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => $items,
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC ProjectFile listTreeNodes failed', [
                'parent_type' => $parentType,
                'parent_ref' => $parentRef,
                'error' => $throwable->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_GET_LINK)]
    public function getLink(array $params): array
    {
        $projectFileId = (int) ($params['project_file_id'] ?? 0);
        if ($projectFileId <= 0) {
            return [
                'code' => 400,
                'message' => 'project_file_id is required',
            ];
        }

        try {
            $fileEntity = $this->taskFileDomainService->getById($projectFileId);
            if ($fileEntity === null) {
                return [
                    'code' => 404,
                    'message' => 'project file not found',
                ];
            }

            if ($fileEntity->getIsDirectory()) {
                return [
                    'code' => 400,
                    'message' => 'project file is directory',
                ];
            }

            $url = $this->taskFileDomainService->getFilePreSignedUrl(
                $fileEntity->getOrganizationCode(),
                $fileEntity,
                [
                    'expires' => max(60, (int) ($params['expire_seconds'] ?? 600)),
                    'method' => 'GET',
                ]
            );

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'url' => $url,
                ],
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC ProjectFile getLink failed', [
                'project_file_id' => $projectFileId,
                'error' => $throwable->getMessage(),
            ]);
            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    private function buildDocumentFilePayload(TaskFileEntity $fileEntity, string $workDir): array
    {
        $fileItem = TaskFileItemDTO::fromEntity($fileEntity, $workDir);

        return [
            'type' => 'project_file',
            'name' => $fileItem->fileName,
            'url' => '',
            'size' => $fileItem->fileSize,
            'extension' => $fileItem->fileExtension,
            'source_type' => 'project',
            'project_id' => (int) $fileItem->projectId,
            'project_file_id' => (int) $fileItem->fileId,
            'file_key' => $fileItem->fileKey,
            'relative_file_path' => $fileItem->relativeFilePath,
        ];
    }

    private function buildResolvePayload(
        TaskFileEntity $fileEntity,
        array $documentFile,
        string $status,
        string $content,
    ): array {
        return [
            'status' => $status,
            'organization_code' => $fileEntity->getOrganizationCode(),
            'project_id' => $fileEntity->getProjectId(),
            'project_file_id' => $fileEntity->getFileId(),
            'file_key' => $fileEntity->getFileKey(),
            'relative_file_path' => $documentFile['relative_file_path'],
            'file_name' => $fileEntity->getFileName(),
            'file_extension' => $fileEntity->getFileExtension(),
            'is_directory' => $fileEntity->getIsDirectory(),
            'updated_at' => $fileEntity->getUpdatedAt(),
            'content' => $content,
            'content_hash' => $content === '' ? '' : sha1($content),
            'doc_type' => $this->resolveDocType($fileEntity->getFileExtension()),
            'document_file' => $documentFile,
        ];
    }

    private function buildListItem(TaskFileEntity $fileEntity, string $workDir): array
    {
        $fileItem = TaskFileItemDTO::fromEntity($fileEntity, $workDir);

        return [
            'organization_code' => $fileEntity->getOrganizationCode(),
            'project_id' => (int) $fileItem->projectId,
            'project_file_id' => (int) $fileItem->fileId,
            'file_key' => $fileItem->fileKey,
            'relative_file_path' => $fileItem->relativeFilePath,
            'file_name' => $fileItem->fileName,
            'file_extension' => $fileItem->fileExtension,
            'updated_at' => $fileItem->updatedAt,
        ];
    }

    private function buildTreeNodeItem(TaskFileEntity $fileEntity, string $workDir): array
    {
        $fileItem = TaskFileItemDTO::fromEntity($fileEntity, $workDir);

        return [
            'project_id' => (int) $fileItem->projectId,
            'project_file_id' => (int) $fileItem->fileId,
            'parent_id' => (int) $fileItem->parentId,
            'file_name' => $fileItem->fileName,
            'file_extension' => $fileItem->fileExtension,
            'relative_file_path' => $fileItem->relativeFilePath,
            'is_directory' => $fileItem->isDirectory,
            'updated_at' => $fileItem->updatedAt,
        ];
    }

    private function createDataIsolation(array $params): DataIsolation
    {
        $dataIsolation = (array) ($params['data_isolation'] ?? []);

        return DataIsolation::create(
            (string) ($dataIsolation['organization_code'] ?? ''),
            (string) ($dataIsolation['user_id'] ?? '')
        );
    }

    private function resolveDocType(string $extension): int
    {
        return DocType::fromExtension($extension)->value;
    }
}
