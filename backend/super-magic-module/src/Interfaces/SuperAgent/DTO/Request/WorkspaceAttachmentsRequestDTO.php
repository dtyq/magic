<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

class WorkspaceAttachmentsRequestDTO extends AbstractDTO
{
    /**
     * @var string topic ID
     */
    protected string $topicId = '';

    /**
     * @var string project ID
     */
    protected string $projectId = '';

    /**
     * @var string commit hash
     */
    protected string $commitHash = '';

    /**
     * @var string sandbox ID
     */
    protected string $sandboxId = '';

    /**
     * @var array directory path
     */
    protected array $dir = [];

    /**
     * @var string folder path
     */
    protected string $folder = '';

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(string $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    public function getCommitHash(): string
    {
        return $this->commitHash;
    }

    public function setCommitHash(string $commitHash): self
    {
        $this->commitHash = $commitHash;
        return $this;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }

    public function getDir(): array
    {
        return $this->dir;
    }

    public function setDir(array $dir): self
    {
        $this->dir = $dir;
        return $this;
    }

    public function getFolder(): string
    {
        return $this->folder;
    }

    public function setFolder(string $folder): self
    {
        $this->folder = $folder;
        return $this;
    }

    /**
     * Get validation rules.
     */
    public function rules(): array
    {
        return [
            'topic_id' => 'required|string',
            'commit_hash' => 'required|string',
            'sandbox_id' => 'required|string',
            'dir' => 'required|array',
            'folder' => 'required|string',
        ];
    }

    /**
     * Get validation error messages.
     */
    public function messages(): array
    {
        return [
            'topic_id.required' => 'Topic ID is required',
            'topic_id.string' => 'Topic ID must be a string',
            'commit_hash.required' => 'Commit hash is required',
            'commit_hash.string' => 'Commit hash must be a string',
            'sandbox_id.required' => 'Sandbox ID is required',
            'sandbox_id.string' => 'Sandbox ID must be a string',
            'dir.required' => 'Directory is required',
            'dir.string' => 'Directory must be a string',
            'folder.required' => 'Folder is required',
            'folder.string' => 'Folder must be a string',
        ];
    }

    public static function fromRequest(RequestInterface $request): self
    {
        $requestDTO = new self();
        $requestDTO->setTopicId($request->input('topic_id', ''));
        $requestDTO->setCommitHash($request->input('commit_hash', ''));
        $requestDTO->setSandboxId($request->input('sandbox_id', ''));
        $requestDTO->setDir($request->input('dir', ''));
        $requestDTO->setFolder($request->input('folder', ''));
        return $requestDTO;
    }
}
