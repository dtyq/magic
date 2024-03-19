<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Parameter\Calendar;

use DateTime;
use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Parameter\AbstractParameter;

/**
 * @see https://open.dingtalk.com/document/orgapp/create-event
 */
class CreateEventParameter extends AbstractParameter
{
    /**
     * 日程组织者的unionId.
     */
    private string $userId;

    /**
     * 日程所属的日历ID，统一为primary，表示用户的主日历.
     */
    private string $calendarId;

    /**
     * 日程标题，最大不超过2048个字符.
     */
    private string $summary;

    /**
     * 日程描述，最大不超过5000个字符.
     */
    private string $description = '';

    /**
     * 日程开始时间.
     */
    private DateTime $start;

    /**
     * 日程结束时间.
     */
    private ?DateTime $end = null;

    /**
     * 是否全天日程.
     */
    private bool $isAllDay = false;

    /**
     * 日程循环规则.
     */
    private array $recurrence = [];

    /**
     * 日程参与人列表，最多支持500个参与人.
     */
    private array $attendees = [];

    /**
     * 日程地点.
     */
    private string $location = '';

    /**
     * 日程提醒.
     */
    private array $reminders = [];

    /**
     * 创建日程同时创建线上会议.
     */
    private array $onlineMeetingInfo = [];

    /**
     * JSON格式的扩展能力开关.
     */
    private array $extra = [];

    /**
     * UI配置，控制日程详情页内组件的展示.
     */
    private array $uiConfigs = [];

    /**
     * 富文本描述.
     */
    private array $richTextDescription = [];

    public function toBody(): array
    {
        $body = [
            'summary' => $this->summary,
            'description' => $this->description,
            'start' => $this->formatDatetime($this->start),
        ];

        if (! empty($this->end)) {
            $body['end'] = $this->formatDatetime($this->end);
        }
        $body['isAllDay'] = $this->isAllDay;

        if (! empty($this->recurrence)) {
            $body['recurrence'] = $this->recurrence;
        }
        if (! empty($this->attendees)) {
            $body['attendees'] = $this->attendees;
        }
        if (! empty($this->location)) {
            $body['location'] = [
                'displayName' => $this->location,
            ];
        }
        if (! empty($this->reminders)) {
            $body['reminders'] = $this->reminders;
        }
        if (! empty($this->onlineMeetingInfo)) {
            $body['onlineMeetingInfo'] = $this->onlineMeetingInfo;
        }
        if (! empty($this->extra)) {
            $body['extra'] = $this->extra;
        }
        if (! empty($this->uiConfigs)) {
            $body['uiConfigs'] = $this->uiConfigs;
        }
        if (! empty($this->richTextDescription)) {
            $body['richTextDescription'] = $this->richTextDescription;
        }

        return $body;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getCalendarId(): string
    {
        return $this->calendarId;
    }

    public function setCalendarId(string $calendarId): void
    {
        $this->calendarId = $calendarId;
    }

    public function getSummary(): string
    {
        return $this->summary;
    }

    public function setSummary(string $summary): void
    {
        $this->summary = $summary;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getStart(): DateTime
    {
        return $this->start;
    }

    public function setStart(DateTime $start): void
    {
        $this->start = $start;
    }

    public function getEnd(): ?DateTime
    {
        return $this->end;
    }

    public function setEnd(?DateTime $end): void
    {
        $this->end = $end;
    }

    public function isAllDay(): bool
    {
        return $this->isAllDay;
    }

    public function setIsAllDay(bool $isAllDay): void
    {
        $this->isAllDay = $isAllDay;
    }

    public function getRecurrence(): array
    {
        return $this->recurrence;
    }

    public function setRecurrence(array $recurrence): void
    {
        $this->recurrence = $recurrence;
    }

    public function getAttendees(): array
    {
        return $this->attendees;
    }

    public function setAttendees(array $attendees): void
    {
        $this->attendees = $attendees;
    }

    public function getLocation(): string
    {
        return $this->location;
    }

    public function setLocation(string $location): void
    {
        $this->location = $location;
    }

    public function getReminders(): array
    {
        return $this->reminders;
    }

    public function setReminders(array $reminders): void
    {
        $this->reminders = $reminders;
    }

    public function getOnlineMeetingInfo(): array
    {
        return $this->onlineMeetingInfo;
    }

    public function setOnlineMeetingInfo(array $onlineMeetingInfo): void
    {
        $this->onlineMeetingInfo = $onlineMeetingInfo;
    }

    public function getExtra(): array
    {
        return $this->extra;
    }

    public function setExtra(array $extra): void
    {
        $this->extra = $extra;
    }

    public function getUiConfigs(): array
    {
        return $this->uiConfigs;
    }

    public function setUiConfigs(array $uiConfigs): void
    {
        $this->uiConfigs = $uiConfigs;
    }

    public function getRichTextDescription(): array
    {
        return $this->richTextDescription;
    }

    public function setRichTextDescription(array $richTextDescription): void
    {
        $this->richTextDescription = $richTextDescription;
    }

    protected function validateParams(): void
    {
        if (empty($this->userId)) {
            throw new InvalidParameterException('userId 不能为空');
        }
        if (empty($this->summary)) {
            throw new InvalidParameterException('日程标题 不能为空');
        }
        if (empty($this->start)) {
            throw new InvalidParameterException('日程开始时间 不能为空');
        }

        if (empty($this->calendarId)) {
            $this->calendarId = 'primary';
        }
    }

    private function formatDatetime(DateTime $dateTime): array
    {
        if ($this->isAllDay) {
            return [
                'date' => $dateTime->format('Y-m-d'),
            ];
        }
        return [
            'dateTime' => $dateTime->format('Y-m-d\TH:i:sP'),
            'timeZone' => $dateTime->getTimezone()->getName(),
        ];
    }
}
