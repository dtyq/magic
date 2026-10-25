<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Task\Assembler;

use App\Application\SuperMagic\File\Service\FileReferenceAppService;
use App\Domain\Chat\Entity\ValueObject\FileType as ChatFileType;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\Utils\TiptapBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\DTO\Request\FileReferenceSelectorDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileReferenceDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileReferenceStatus;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateOpenTaskRequestDTO;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateTaskRequestDTO;
use JsonException;

/**
 * Adapts open-api inputs and authorized file identities to the standard message envelope.
 * Message parsing, classification and execution belong to the shared message pipeline.
 */
class OpenTaskMessageAssembler
{
    public function __construct(
        private readonly FileReferenceAppService $references,
        private readonly TaskFileDomainService $files,
    ) {
    }

    public function prepare(MagicUserAuthorization $authorization, CreateOpenTaskRequestDTO $requestDTO): CreateTaskRequestDTO
    {
        $internalDTO = $requestDTO->toCreateTaskRequestDTO();
        $content = $internalDTO->getMessageContent();
        $content['instructs'] ??= [['value' => 'normal', 'instruction' => null]];
        $content['extra'] ??= [];
        $content['extra']['super_agent'] ??= [];
        unset($content['extra']['super_agent']['processed_by_api'], $content['extra']['super_agent']['source'], $content['extra']['super_agent']['queue_id']);
        if (isset($content['extra']['super_agent']['enable_web_search'])) {
            $content['extra']['super_agent']['enable_web_search'] = in_array($content['extra']['super_agent']['enable_web_search'], [true, 1, '1'], true);
        }

        $doc = $this->decodeDocument($content['content']);
        $expected = [];
        $fileIds = array_values(array_unique($requestDTO->getFileIds(), SORT_STRING));
        foreach ($fileIds as $id) {
            $this->addExpectedReference($expected, $id, false);
        }
        $this->walkDocument($doc, function (array $node) use (&$expected): array {
            if ($node['type'] === 'mention') {
                $this->collectProjectMention($node, $expected);
            }
            return $node;
        });
        foreach ($content['extra']['super_agent']['mentions'] ?? [] as $mention) {
            if (! is_array($mention)) {
                $this->invalidReference();
            }
            $this->collectProjectMention($mention, $expected);
        }
        foreach ($content['attachments'] ?? [] as $attachment) {
            if (! is_array($attachment)) {
                $this->invalidReference();
            }
            if (($attachment['type'] ?? '') === 'project_file') {
                $this->addExpectedReference($expected, $attachment['file_id'] ?? null, false);
            }
        }

        [$references, $entities] = $this->resolveProjectReferences($authorization, $expected);
        if ($fileIds !== []) {
            $nodes = array_map(fn (string $id): array => $this->buildProjectFileNode($references[$id], $entities[$id]), $fileIds);
            $doc = $this->decodeDocument(TiptapBuilder::plainTextWithMentionsToJson($requestDTO->getContent(), $nodes));
        }
        if ($expected !== []) {
            $doc = $this->walkDocument($doc, fn (array $node): array => $node['type'] === 'mention'
                ? $this->prepareProjectMention($node, $references, $entities) : $node);
            $content['content'] = TiptapBuilder::toJson($doc);
        }
        foreach ($content['extra']['super_agent']['mentions'] ?? [] as $index => $mention) {
            $content['extra']['super_agent']['mentions'][$index] = $this->prepareProjectMention($mention, $references, $entities);
        }

        // Keep ordinary chat attachments; rebuild every project attachment from real metadata.
        $attachments = array_values(array_filter($content['attachments'] ?? [], static fn (array $item): bool => ($item['type'] ?? '') !== 'project_file'));
        foreach ($expected as $id => $isDirectory) {
            if (! $isDirectory) {
                $attachments[] = $this->buildProjectFileAttachment($entities[$id]);
            }
        }
        if ($attachments !== []) {
            $content['attachments'] = $attachments;
        } else {
            unset($content['attachments']);
        }

        $data = [
            'project_id' => $internalDTO->getProjectId(),
            'topic_id' => $internalDTO->getTopicId(),
            'message_type' => $internalDTO->getMessageType(),
            'message_content' => $content,
            'force_interrupt' => $internalDTO->isForceInterrupt(),
        ];
        // Preserve the legacy plain-text limit without charging it for server-side JSON framing.
        return $requestDTO->getContentType() === 'rich_text' || $fileIds !== []
            ? CreateTaskRequestDTO::fromValidatedArray($data)
            : new CreateTaskRequestDTO($data);
    }

    private function collectProjectMention(array $node, array &$expected): void
    {
        $type = $node['attrs']['type'] ?? null;
        if ($type === 'project_file') {
            $this->addExpectedReference($expected, $node['attrs']['data']['file_id'] ?? null, false);
        } elseif ($type === 'project_directory') {
            $this->addExpectedReference($expected, $node['attrs']['data']['directory_id'] ?? null, true);
        }
    }

    private function addExpectedReference(array &$expected, mixed $id, bool $isDirectory): void
    {
        $selector = FileReferenceSelectorDTO::fromInput(['file_id' => $id]);
        if (! $selector->isValid()) {
            $this->invalidReference();
        }
        $key = (string) $selector->fileId;
        if (array_key_exists($key, $expected) && $expected[$key] !== $isDirectory) {
            $this->invalidReference();
        }
        $expected[$key] = $isDirectory;
    }

    /** @return array{array<int, FileReferenceDTO>, array<int, TaskFileEntity>} */
    private function resolveProjectReferences(MagicUserAuthorization $authorization, array $expected): array
    {
        if ($expected === []) {
            return [[], []];
        }
        $ids = array_keys($expected);
        $selectors = array_map(static fn (int|string $id): FileReferenceSelectorDTO => FileReferenceSelectorDTO::fromInput(['file_id' => $id]), $ids);
        $results = $this->references->resolve($authorization, $selectors);
        $references = [];
        foreach ($ids as $index => $id) {
            $result = $results[$index] ?? null;
            $reference = $result?->reference;
            if ($result?->status !== FileReferenceStatus::Resolved || $reference === null
                || $reference->spaceType !== FileSpaceType::PROJECT || $reference->isDirectory !== $expected[$id]) {
                $this->invalidReference();
            }
            $references[$id] = $reference;
        }
        $entities = [];
        foreach ($this->files->getFilesByIds(array_map('intval', $ids)) as $file) {
            $entities[$file->getFileId()] = $file;
        }
        foreach ($references as $id => $reference) {
            $entity = $entities[$id] ?? null;
            if ($entity === null || ! $entity->isProjectFile() || $entity->getIsDirectory() !== $reference->isDirectory
                || (string) $entity->getProjectId() !== $reference->projectId) {
                $this->invalidReference();
            }
        }
        return [$references, $entities];
    }

    private function prepareProjectMention(array $node, array $references, array $entities): array
    {
        $type = $node['attrs']['type'] ?? null;
        if (! in_array($type, ['project_file', 'project_directory'], true)) {
            return $node;
        }
        $id = (string) ($type === 'project_file' ? $node['attrs']['data']['file_id'] : $node['attrs']['data']['directory_id']);
        $reference = $references[$id];
        $entity = $entities[$id];
        $node['attrs']['label'] = $reference->fileName;
        $node['attrs']['pending'] = false;
        $node['attrs']['pendingId'] = null;
        if ($type === 'project_file') {
            $node['attrs']['data'] = $this->buildProjectFileNode($reference, $entity)['attrs']['data'];
        } else {
            $metadata = json_decode($entity->getDisplayConfig() ?? '', true);
            $node['attrs']['data'] = [
                'directory_id' => $reference->fileId,
                'directory_name' => $reference->fileName,
                'directory_path' => rtrim($reference->spaceRelativePath, '/') . '/',
                'directory_metadata' => is_array($metadata) ? $metadata : [],
                'project_id' => $reference->projectId,
            ];
        }
        return $node;
    }

    private function buildProjectFileNode(FileReferenceDTO $reference, TaskFileEntity $entity): array
    {
        return [
            'type' => 'mention',
            'attrs' => [
                'id' => null,
                'label' => $reference->fileName,
                'mentionSuggestionChar' => '@',
                'type' => 'project_file',
                'pending' => false,
                'pendingId' => null,
                'data' => [
                    'file_id' => $reference->fileId,
                    'file_name' => $reference->fileName,
                    'file_path' => $reference->spaceRelativePath,
                    'project_id' => $reference->projectId,
                    'file_key' => $entity->getFileKey(),
                    'file_size' => $entity->getFileSize(),
                    'file_extension' => $reference->fileExtension,
                ],
            ],
        ];
    }

    private function buildProjectFileAttachment(TaskFileEntity $entity): array
    {
        return [
            'type' => 'project_file',
            'file_id' => (string) $entity->getFileId(),
            'file_name' => $entity->getFileName(),
            'file_extension' => $entity->getFileExtension(),
            'file_size' => $entity->getFileSize(),
            'file_type' => ChatFileType::getTypeFromFileExtension($entity->getFileExtension())->value,
        ];
    }

    private function decodeDocument(string $content): array
    {
        try {
            $document = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_rich_content');
        }
        if (! is_array($document) || ($document['type'] ?? '') !== 'doc' || ! is_array($document['content'] ?? null)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_rich_content');
        }
        return $document;
    }

    private function walkDocument(array $node, callable $visitor, int $depth = 0): array
    {
        if ($depth > 512 || ! is_string($node['type'] ?? null)
            || (isset($node['content']) && (! is_array($node['content']) || ! array_is_list($node['content'])))) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_rich_content');
        }
        $node = $visitor($node);
        foreach ($node['content'] ?? [] as $index => $child) {
            if (! is_array($child)) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_rich_content');
            }
            $node['content'][$index] = $this->walkDocument($child, $visitor, $depth + 1);
        }
        return $node;
    }

    private function invalidReference(): never
    {
        ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_file_reference');
    }
}
