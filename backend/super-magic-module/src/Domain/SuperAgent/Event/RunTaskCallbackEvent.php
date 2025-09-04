<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\TopicTaskMessageDTO;

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
        private string $language
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
