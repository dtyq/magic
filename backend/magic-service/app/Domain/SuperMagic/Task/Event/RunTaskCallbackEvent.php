<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Event;

use App\Domain\SuperMagic\Common\Event\AbstractEvent;
use App\Interfaces\SuperMagic\Message\DTO\TopicTaskMessageDTO;

class RunTaskCallbackEvent extends AbstractEvent
{
    private array $departmentIds;

    public function __construct(
        private string $organizationCode,
        private string $userId,
        private int $topicId,
        private string $topicName,
        private int $taskId,
        private TopicTaskMessageDTO $taskMessage,
        private string $language,
        private ?string $projectId = null,
        private ?string $projectName = null,
        private ?string $workspaceId = null,
        private ?string $workspaceName = null
    ) {
        // Call parent constructor to generate snowflake ID
        parent::__construct();
        $this->departmentIds = $this->extractDepartmentIds();
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }

    public function getTopicName(): string
    {
        return $this->topicName;
    }

    public function getTaskId(): int
    {
        return $this->taskId;
    }

    public function getTaskMessage(): TopicTaskMessageDTO
    {
        return $this->taskMessage;
    }

    /**
     * Get department IDs from the user information in the task message.
     *
     * @return string[]
     */
    public function getDepartmentIds(): array
    {
        return $this->departmentIds;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function getProjectId(): string
    {
        return $this->projectId ?? '';
    }

    public function getProjectName(): string
    {
        return $this->projectName ?? '';
    }

    public function getWorkspaceId(): string
    {
        return $this->workspaceId ?? '';
    }

    public function getWorkspaceName(): string
    {
        return $this->workspaceName ?? '';
    }

    /**
     * Convert the event object to array format.
     */
    public function toArray(): array
    {
        return [
            'organizationCode' => $this->organizationCode,
            'userId' => $this->userId,
            'topicId' => $this->topicId,
            'topicName' => $this->topicName,
            'taskId' => $this->taskId,
            'taskMessage' => $this->taskMessage->toArray() ?? $this->taskMessage,
            'departmentIds' => $this->departmentIds,
            'language' => $this->language,
            'projectId' => $this->getProjectId(),
            'projectName' => $this->getProjectName(),
            'workspaceId' => $this->getWorkspaceId(),
            'workspaceName' => $this->getWorkspaceName(),
        ];
    }

    private function extractDepartmentIds(): array
    {
        $departmentIds = [];
        $metadata = $this->taskMessage->getMetadata();
        $userInfo = $metadata->getUserInfo();
        if ($userInfo) {
            $departments = $userInfo->getDepartments();
            foreach ($departments as $department) {
                $departmentIds[] = $department->getId();
            }
        }
        return $departmentIds;
    }
}
