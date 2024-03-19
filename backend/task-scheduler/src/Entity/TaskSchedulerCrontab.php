<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Entity;

use Cron\CronExpression;
use DateTime;
use Dtyq\TaskScheduler\Exception\TaskSchedulerParamsSchedulerException;
use Dtyq\TaskScheduler\Util\Functions;

class TaskSchedulerCrontab
{
    private int $id;

    private string $environment;

    /**
     * 业务id.
     * 一般用于业务识别.
     * 可作为来源标识.
     */
    private string $externalId;

    private string $name;

    private string $crontab;

    private DateTime $lastGenTime;

    private bool $enabled;

    private int $retryTimes;

    private array $callbackMethod;

    private array $callbackParams = [];

    private ?DateTime $deadline = null;

    private string $remark = '';

    private string $creator = '';

    private string $filterId = '';

    private DateTime $createdAt;

    public function prepareForCreate(): void
    {
        if (empty($this->environment)) {
            $this->environment = Functions::getEnv();
        }
        if (empty($this->name)) {
            throw new TaskSchedulerParamsSchedulerException('定时名称 不能为空');
        }
        if (empty($this->externalId)) {
            throw new TaskSchedulerParamsSchedulerException('业务标识 不能为空');
        }
        if (empty($this->crontab)) {
            throw new TaskSchedulerParamsSchedulerException('定时规则 不能为空');
        }
        if (! CronExpression::isValidExpression($this->crontab)) {
            throw new TaskSchedulerParamsSchedulerException('定时规则 格式错误');
        }
        if (empty($this->lastGenTime)) {
            $this->lastGenTime = new DateTime();
        }
        if (! isset($this->enabled)) {
            throw new TaskSchedulerParamsSchedulerException('是否启用 不能为空');
        }
        if (! isset($this->retryTimes) || $this->retryTimes < 0) {
            $this->retryTimes = 0;
        }
        if (! is_null($this->deadline)) {
            $deadlineDate = date('Y-m-d', $this->deadline->getTimestamp());
            $deadlineDate = strtotime($deadlineDate);
            $nowDate = date('Y-m-d', time());
            $nowDate = strtotime($nowDate);
            if ($deadlineDate < $nowDate) {
                throw new TaskSchedulerParamsSchedulerException('结束时间 不能小于当前时间');
            }
        }

        $this->checkCallbackMethod();
        unset($this->id);
        $this->createdAt = new DateTime();
    }

    public function prepareForUpdate(): void
    {
        if (empty($this->environment)) {
            $this->environment = Functions::getEnv();
        }
        if (empty($this->name)) {
            throw new TaskSchedulerParamsSchedulerException('定时名称 不能为空');
        }
        if (empty($this->externalId)) {
            throw new TaskSchedulerParamsSchedulerException('业务标识 不能为空');
        }
        if (empty($this->crontab)) {
            throw new TaskSchedulerParamsSchedulerException('定时规则 不能为空');
        }
        if (! CronExpression::isValidExpression($this->crontab)) {
            throw new TaskSchedulerParamsSchedulerException('定时规则 格式错误');
        }
        if (empty($this->lastGenTime)) {
            $this->lastGenTime = new DateTime();
        }
        if (! isset($this->enabled)) {
            throw new TaskSchedulerParamsSchedulerException('是否启用 不能为空');
        }
        if (! isset($this->retryTimes) || $this->retryTimes < 0) {
            $this->retryTimes = 0;
        }
        if (! is_null($this->deadline)) {
            $deadlineDate = date('Y-m-d', $this->deadline->getTimestamp());
            $deadlineDate = strtotime($deadlineDate);
            $nowDate = date('Y-m-d', time());
            $nowDate = strtotime($nowDate);
            if ($deadlineDate < $nowDate) {
                throw new TaskSchedulerParamsSchedulerException('结束时间 不能小于当前时间');
            }
        }

        $this->checkCallbackMethod();

        $this->createdAt = new DateTime();
    }

    public function prepareForCreateScheduleTask(): void
    {
        if (empty($this->id)) {
            throw new TaskSchedulerParamsSchedulerException('定时任务ID 不能为空');
        }
        if (empty($this->crontab)) {
            throw new TaskSchedulerParamsSchedulerException('定时规则 不能为空');
        }
        if (! CronExpression::isValidExpression($this->crontab)) {
            throw new TaskSchedulerParamsSchedulerException('定时规则 格式错误');
        }
        if (empty($this->lastGenTime)) {
            $this->lastGenTime = new DateTime();
        }
        if (! $this->enabled) {
            throw new TaskSchedulerParamsSchedulerException('未启用的定时任务不能生成调度任务');
        }
        $this->checkCallbackMethod();
    }

    /**
     * 获取指定日期内的数据.
     * @return DateTime[]
     */
    public function listCycleDate(DateTime $endTime, int $limit = 50): array
    {
        if ($endTime < $this->lastGenTime) {
            return [];
        }
        $list = [];

        $cron = new CronExpression($this->crontab);

        $runDates = $cron->getMultipleRunDates($limit, $this->lastGenTime, false, false);
        foreach ($runDates as $runDate) {
            // 如果超过了结束时间，就不需要了
            if ($runDate > $endTime) {
                break;
            }
            $list[] = $runDate;
            // 更新上次时间
            $this->lastGenTime = $runDate;
        }
        return $list;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): void
    {
        $this->id = $id;
    }

    public function getEnvironment(): string
    {
        return $this->environment;
    }

    public function setEnvironment(string $environment): void
    {
        $this->environment = $environment;
    }

    public function getExternalId(): string
    {
        return $this->externalId;
    }

    public function setExternalId(string $externalId): void
    {
        $this->externalId = $externalId;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getCrontab(): string
    {
        return $this->crontab;
    }

    public function setCrontab(string $crontab): void
    {
        $this->crontab = $crontab;
    }

    public function getLastGenTime(): DateTime
    {
        return $this->lastGenTime;
    }

    public function setLastGenTime(DateTime $lastGenTime): void
    {
        $this->lastGenTime = $lastGenTime;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getCallbackMethod(): array
    {
        return $this->callbackMethod;
    }

    public function setCallbackMethod(array $callbackMethod): void
    {
        $this->callbackMethod = $callbackMethod;
    }

    public function getCallbackParams(): array
    {
        return $this->callbackParams;
    }

    public function setCallbackParams(array $callbackParams): void
    {
        $this->callbackParams = $callbackParams;
    }

    public function getRemark(): string
    {
        return $this->remark;
    }

    public function setRemark(string $remark): void
    {
        $this->remark = $remark;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getRetryTimes(): int
    {
        return $this->retryTimes;
    }

    public function setRetryTimes(int $retryTimes): void
    {
        $this->retryTimes = $retryTimes;
    }

    public function getDeadline(): ?DateTime
    {
        return $this->deadline;
    }

    public function setDeadline(?DateTime $deadline): void
    {
        $this->deadline = $deadline;
    }

    public function toModelArray(): array
    {
        return [
            'environment' => $this->environment,
            'external_id' => $this->externalId,
            'name' => $this->name,
            'crontab' => $this->crontab,
            'last_gen_time' => $this->lastGenTime,
            'enabled' => $this->enabled,
            'retry_times' => $this->retryTimes,
            'callback_method' => $this->callbackMethod,
            'callback_params' => $this->callbackParams,
            'remark' => $this->remark,
            'deadline' => $this->deadline,
            'creator' => $this->creator,
            'filter_id' => $this->filterId,
            'created_at' => $this->createdAt,
        ];
    }

    /**
     * Get the value of filterId.
     */
    public function getFilterId(): string
    {
        return $this->filterId;
    }

    /**
     * Set the value of filterId.
     */
    public function setFilterId(string $filterId): self
    {
        $this->filterId = $filterId;

        return $this;
    }

    private function checkCallbackMethod(): void
    {
        if (empty($this->callbackMethod)) {
            throw new TaskSchedulerParamsSchedulerException('调度方法 不能为空');
        }
        if (count($this->callbackMethod) !== 2) {
            throw new TaskSchedulerParamsSchedulerException('调度方法格式错误');
        }
        foreach ($this->callbackMethod as $method) {
            if (! is_string($method)) {
                throw new TaskSchedulerParamsSchedulerException('调度方法格式错误');
            }
        }
    }
}
