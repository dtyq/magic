<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Service;

use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\File\Service\FileTemporaryCredentialDomainService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\File\Constant\ProjectFileConstant;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Event\AttachmentsProcessedEvent;
use App\Domain\SuperMagic\File\Event\FileUploadedEvent;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\File\Service\UpsertProjectFileNodeDTO;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Infrastructure\SuperMagic\Utils\WorkFileUtil;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\DTO\Request\OpenBatchSaveProjectFilesRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\SaveProjectFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\UploadProjectFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\TaskFileItemDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\ProjectUploadTokenRequestDTO;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use GuzzleHttp\Exception\RequestException;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Swow\Psr7\Message\UploadedFile;
use Throwable;
use UnexpectedValueException;

use function Hyperf\Config\config;
use function Hyperf\Translation\trans;

/**
 * Open API upload orchestration, validation and response projection.
 * Storage and file-node operations use shared domain services.
 */
class OpenFileAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly FileTemporaryCredentialDomainService $temporaryCredentialDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly LockerInterface $locker,
        private readonly EventDispatcherInterface $eventDispatcher,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function getProjectUploadToken(RequestContext $requestContext, ProjectUploadTokenRequestDTO $requestDTO): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $organization = $authorization->getOrganizationCode();
        if (! empty($requestDTO->getProjectId())) {
            $project = $this->getAccessibleProjectWithEditor((int) $requestDTO->getProjectId(), $authorization->getId(), $organization);
            $workDir = $project->getWorkDir();
            $organization = $project->getUserOrganizationCode();
            if ($workDir === '') {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, 'project.work_dir.not_found');
            }
        } else {
            $workDir = WorkDirectoryUtil::getWorkDir($authorization->getId(), IdGenerator::getSnowId());
        }
        try {
            return $this->temporaryCredentialDomainService->getStsTemporaryCredentialV2(
                $organization,
                StorageBucketType::SandBox,
                $workDir,
                $requestDTO->getExpires(),
                false,
            );
        } catch (BusinessException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            $this->logUploadFailure('', 'sts', $exception);
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'system.upload_token_failed');
        }
    }

    public function batchSaveProjectFiles(RequestContext $requestContext, OpenBatchSaveProjectFilesRequestDTO $requestDTO): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $project = $this->getAccessibleProjectWithEditor((int) $requestDTO->getProjectId(), $authorization->getId(), $authorization->getOrganizationCode());
        $this->validateParentDirectory($requestDTO->getParentId(), $project->getId());
        if (empty($project->getWorkDir())) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, 'project.work_dir.not_found');
        }

        $results = [];
        $ready = [];
        foreach ($requestDTO->getFiles() as $file) {
            $key = $file['file_key'];
            try {
                $this->assertProjectUploadKey($project, $key);
                $head = $this->fileDomainService->getHeadObjectByCredential($project->getUserOrganizationCode(), $key, StorageBucketType::SandBox);
                $size = filter_var($head['content_length'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
                if ($size === false) {
                    throw new UnexpectedValueException('Missing or invalid content_length');
                }
                // Only server-owned project-upload metadata reaches the existing save flow.
                $ready[] = [
                    'file_key' => $key,
                    'file_name' => $file['file_name'],
                    'file_size' => $size,
                    'file_type' => FileType::USER_UPLOAD->value,
                    'storage_type' => StorageType::WORKSPACE->value,
                    'source' => TaskFileSource::DEFAULT->value,
                    'is_directory' => false,
                ];
            } catch (Throwable $exception) {
                $this->logUploadFailure($key, 'head', $exception);
                $results[$key] = ['file_id' => '', 'error' => $this->toUploadError($exception, 'head')];
            }
        }
        if ($ready !== []) {
            $results = array_replace($results, $this->registerReadyFiles($authorization, $project, $requestDTO->getParentId(), $ready));
        }
        return $results;
    }

    public function uploadProjectFile(RequestContext $requestContext, UploadProjectFileRequestDTO $requestDTO, UploadedFile $file): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $project = $this->getAccessibleProjectWithEditor((int) $requestDTO->getProjectId(), $authorization->getId(), $authorization->getOrganizationCode());
        $this->validateParentDirectory($requestDTO->getParentId(), $project->getId());
        $tmpPath = $file->toArray()['tmp_file'] ?? '';
        if ($file->getError() !== UPLOAD_ERR_OK || $tmpPath === '' || ! is_file($tmpPath) || ! is_readable($tmpPath)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.open_api.invalid_upload');
        }
        $size = filesize($tmpPath);
        if ($size === false) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.open_api.invalid_upload');
        }
        if ($size > (int) config('super-magic.open_api.file_upload_max_size', 50 * 1024 * 1024)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.open_api.upload_too_large');
        }
        $name = $requestDTO->getFileName() ?: ($file->getClientFilename() ?? '');
        if (! WorkFileUtil::isValidFileName($name)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.illegal_file_name');
        }
        $organizationCode = $project->getUserOrganizationCode();
        $prefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
        $key = WorkDirectoryUtil::getFullFileKey($prefix, $project->getWorkDir(), (string) IdGenerator::getSnowId());
        $this->assertProjectUploadKey($project, $key);
        try {
            $this->fileDomainService->uploadByCredential($organizationCode, new UploadFile($tmpPath, '', $key, false), StorageBucketType::SandBox, false);
            $result = $this->saveUploadedFile($authorization, $project, SaveProjectFileRequestDTO::fromRequest([
                'project_id' => $requestDTO->getProjectId(),
                'parent_id' => $requestDTO->getParentId(),
                'file_key' => $key,
                'file_name' => $name,
                'file_size' => $size,
                'file_type' => FileType::USER_UPLOAD->value,
                'storage_type' => StorageType::WORKSPACE->value,
                'source' => TaskFileSource::DEFAULT->value,
                'is_directory' => false,
            ]));
            unset($result['relative_file_path']);
            return $result;
        } catch (Throwable $exception) {
            // A save error may follow a committed record; retain the object when its state is uncertain.
            $this->logUploadFailure($key, 'upload', $exception);
            throw $exception;
        }
    }

    private function saveUploadedFile(MagicUserAuthorization $authorization, ProjectEntity $project, SaveProjectFileRequestDTO $dto): array
    {
        $lockName = WorkDirectoryUtil::getLockerKey($project->getId());
        $lockOwner = $authorization->getId();
        if (! $this->locker->spinLock($lockName, $lockOwner, 30)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_SAVE_FAILED, 'file.directory_creation_locked');
        }
        try {
            $project = $this->getAccessibleProjectWithEditor($project->getId(), $authorization->getId(), $authorization->getOrganizationCode());
            $this->validateParentDirectory($dto->getParentId(), $project->getId());
            $this->assertProjectUploadKey($project, $dto->getFileKey());
            $entity = Db::transaction(fn (): TaskFileEntity => $this->taskFileDomainService->upsertProjectFileNode(new UpsertProjectFileNodeDTO(
                projectId: $project->getId(),
                projectWorkDir: $project->getWorkDir(),
                projectOrganizationCode: $project->getUserOrganizationCode(),
                operatorUserId: $authorization->getId(),
                operatorOrganizationCode: $authorization->getOrganizationCode(),
                taskFileEntity: $dto->toEntity(),
                storageTypeOverride: StorageType::WORKSPACE->value,
                isHidden: $dto->getIsHidden(),
            )));
            $this->eventDispatcher->dispatch(new FileUploadedEvent($entity, $authorization->getId(), $authorization->getOrganizationCode()));
            // Explicitly omit logical-path projection for the open upload response.
            return TaskFileItemDTO::fromEntity($entity, relativeFilePath: '')->toArray();
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * Register verified objects with the open API's partial-success contract.
     * Unexpected failures abort the whole batch; domain upserts retain node/version semantics.
     */
    private function registerReadyFiles(MagicUserAuthorization $authorization, ProjectEntity $project, string $parentId, array $files): array
    {
        $lockName = WorkDirectoryUtil::getLockerKey($project->getId());
        $lockOwner = $authorization->getId();
        if (! $this->locker->spinLock($lockName, $lockOwner, 30)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_SAVE_FAILED, 'file.batch_save_locked');
        }

        $transactionStarted = false;
        $originalTransactionLevel = 0;
        try {
            $project = $this->getAccessibleProjectWithEditor($project->getId(), $authorization->getId(), $authorization->getOrganizationCode());
            $this->validateParentDirectory($parentId, $project->getId());
            $originalTransactionLevel = Db::connection()->transactionLevel();
            Db::beginTransaction();
            $transactionStarted = true;
            $batchTransactionLevel = Db::connection()->transactionLevel();
            $results = [];
            $savedEntities = [];
            foreach ($files as $file) {
                $key = $file['file_key'];
                try {
                    $this->assertProjectUploadKey($project, $key);
                    $dto = SaveProjectFileRequestDTO::fromRequest(array_merge($file, [
                        'project_id' => (string) $project->getId(),
                        'parent_id' => $parentId,
                    ]));
                    $entity = $this->taskFileDomainService->upsertProjectFileNode(new UpsertProjectFileNodeDTO(
                        projectId: $project->getId(),
                        projectWorkDir: $project->getWorkDir(),
                        projectOrganizationCode: $project->getUserOrganizationCode(),
                        operatorUserId: $authorization->getId(),
                        operatorOrganizationCode: $authorization->getOrganizationCode(),
                        taskFileEntity: $dto->toEntity(),
                        storageTypeOverride: StorageType::WORKSPACE->value,
                        isHidden: $dto->getIsHidden(),
                    ));
                    $results[$key] = ['file_id' => (string) $entity->getFileId(), 'error' => ''];
                    $savedEntities[] = $entity;
                } catch (Throwable $exception) {
                    if (! $this->isRecoverableRegistrationError($exception, $batchTransactionLevel)) {
                        throw $exception;
                    }
                    $this->logUploadFailure($key, 'save', $exception);
                    $results[$key] = ['file_id' => '', 'error' => $this->toUploadError($exception, 'save')];
                }
            }
            Db::commit();
            $transactionStarted = false;

            foreach ($savedEntities as $entity) {
                $this->eventDispatcher->dispatch(new FileUploadedEvent($entity, $authorization->getId(), $authorization->getOrganizationCode()));
            }
            foreach ($savedEntities as $entity) {
                if (ProjectFileConstant::isSetMetadataFile($entity->getFileName())) {
                    $this->eventDispatcher->dispatch(new AttachmentsProcessedEvent($entity->getParentId(), $entity->getProjectId(), $entity->getTaskId()));
                    break;
                }
            }
            return $results;
        } catch (Throwable $exception) {
            while ($transactionStarted && Db::connection()->transactionLevel() > $originalTransactionLevel) {
                Db::rollBack();
            }
            $this->logger->error('Open API batch registration failed', [
                'project_id' => $project->getId(),
                'error' => $exception->getMessage(),
            ]);
            if ($exception instanceof BusinessException) {
                throw $exception;
            }
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_SAVE_FAILED, 'file.batch_save_failed');
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    private function validateParentDirectory(string $parentId, int $projectId): void
    {
        if ($parentId === '') {
            return;
        }
        $parent = $this->taskFileDomainService->getById((int) $parentId);
        if ($parent === null || ! $parent->isProjectFile() || $parent->getProjectId() !== $projectId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.not_found');
        }
        if (! $parent->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_SAVE_FAILED, 'file.target_parent_not_directory');
        }
    }

    private function assertProjectUploadKey(ProjectEntity $project, string $fileKey): void
    {
        if (empty($project->getWorkDir())) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, 'project.work_dir.not_found');
        }
        // This prefix check authorizes physical storage access, never logical parent relationships.
        $prefix = $this->taskFileDomainService->getFullPrefix($project->getUserOrganizationCode());
        $fullWorkDir = WorkDirectoryUtil::getFullWorkdir($prefix, $project->getWorkDir());
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkDir, $fileKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.open_api.key_out_of_scope');
        }
    }

    private function logUploadFailure(string $fileKey, string $stage, Throwable $exception): void
    {
        $this->logger->warning('Open API project upload failed', [
            'file_key' => $fileKey,
            'stage' => $stage,
            'error_code' => $exception->getCode(),
            'error' => $exception->getMessage(),
        ]);
    }

    private function toUploadError(Throwable $exception, string $stage): string
    {
        if ($stage === 'head') {
            if ($exception instanceof BusinessException && $exception->getCode() === SuperAgentErrorCode::FILE_PERMISSION_DENIED->value) {
                return trans('file.open_api.key_out_of_scope');
            }
            for ($cause = $exception; $cause !== null; $cause = $cause->getPrevious()) {
                if (($cause instanceof CloudFileException && $cause->getCode() === 404)
                    || ($cause instanceof RequestException && $cause->getResponse()?->getStatusCode() === 404)) {
                    return trans('file.open_api.upload_not_completed');
                }
            }
            return trans('file.open_api.head_failed');
        }
        return $exception instanceof BusinessException && $exception->getMessage() !== ''
            ? $exception->getMessage()
            : trans('file.open_api.registration_failed');
    }

    private function isRecoverableRegistrationError(Throwable $exception, int $transactionLevel): bool
    {
        $recoverableCodes = [
            GenericErrorCode::ParameterMissing->value,
            GenericErrorCode::ParameterValidationFailed->value,
            SuperAgentErrorCode::VALIDATE_FAILED->value,
            SuperAgentErrorCode::FILE_EXIST->value,
            SuperAgentErrorCode::FILE_NOT_FOUND->value,
            SuperAgentErrorCode::FILE_PERMISSION_DENIED->value,
            SuperAgentErrorCode::FILE_UPLOAD_FAILED->value,
        ];
        for ($cause = $exception; $cause !== null; $cause = $cause->getPrevious()) {
            // Wrapped database failures are not safe per-file errors, even when translated.
            if (! $cause instanceof BusinessException || ! in_array($cause->getCode(), $recoverableCodes, true)) {
                return false;
            }
        }
        return Db::connection()->transactionLevel() === $transactionLevel;
    }
}
