<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Entity;

use DateTime;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskSchedulerExecuteResult;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskSchedulerStatus;
use Dtyq\TaskScheduler\Exception\TaskSchedulerParamsSchedulerException;
use Dtyq\TaskScheduler\Util\Functions;

class TaskSchedulerLog
{
    private int $id;

    private int $taskId;

    private string $environment;

    /**
     * 调度标识.
     * 一般用于业务识别.
     * 可作为来源标识.
     */
    private string $externalId;

    /**
     * 调度名称.
     */
    private string $name;

    /**
     * 预期调度时间.
     * 分钟级别.
     */
    private DateTime $expectTime;

    /**
     * 实际调度时间.
     */
    private ?DateTime $actualTime = null;

    /**
     * 调度耗时.
     */
    private int $costTime = 0;

    /**
     * 调度状态
     */
    private TaskSchedulerStatus $status;

    /**
     * 调度类型.
     */
    private int $type;

    /**
     * 调度方法.
     * [Class, Method] 的格式.
     */
    private array $callbackMethod;

    /**
     * 调度方法参数.
     */
    private array $callbackParams = [];

    /**
     * 备注.
     */
    private string $remark = '';

    /**
     * 创建人.
     * 可不填，看业务是否需要.
     */
    private string $creator = '';

    /**
     * 创建时间.
     */
    private DateTime $createdAt;

    /**
     * 调度执行结果.
     */
    private ?TaskSchedulerExecuteResult $result = null;

    public function prepareForCreation(): void
    {
        if (empty($this->environment)) {
            $this->environment = Functions::getEnv();
        }
        if (empty($this->taskId)) {
            throw new TaskSchedulerParamsSchedulerException('任务ID 不能为空');
        }
        if (empty($this->externalId)) {
            throw new TaskSchedulerParamsSchedulerException('业务标识 不能为空');
        }
        if (empty($this->name)) {
            throw new TaskSchedulerParamsSchedulerException('调度名称 不能为空');
        }
        if (empty($this->expectTime)) {
            throw new TaskSchedulerParamsSchedulerException('预期调度时间 不能为空');
        }
        unset($this->id);
    }

    public function toModelArray(): array
    {
        return [
            'environment' => $this->environment,
            'task_id' => $this->taskId,
            'external_id' => $this->externalId,
            'name' => $this->name,
            'expect_time' => $this->expectTime,
            'actual_time' => $this->actualTime,
            'cost_time' => $this->costTime,
            'status' => $this->status->value,
            'callback_method' => $this->callbackMethod,
            'callback_params' => $this->callbackParams,
            'remark' => $this->remark,
            'creator' => $this->creator,
            'created_at' => $this->createdAt,
            'result' => $this->result?->toArray() ?? [],
        ];
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): void
    {
        $this->id = $id;
    }

    public function getTaskId(): int
    {
        return $this->taskId;
    }

    public function setTaskId(int $taskId): void
    {
        $this->taskId = $taskId;
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

    public function getExpectTime(): DateTime
    {
        return $this->expectTime;
    }

    public function setExpectTime(DateTime $expectTime): void
    {
        $this->expectTime = $expectTime;
    }

    public function getActualTime(): ?DateTime
    {
        return $this->actualTime;
    }

    public function setActualTime(?DateTime $actualTime): void
    {
        $this->actualTime = $actualTime;
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(int $type): void
    {
        $this->type = $type;
    }

    public function getCostTime(): int
    {
        return $this->costTime;
    }

    public function setCostTime(int $costTime): void
    {
        $this->costTime = $costTime;
    }

    public function getStatus(): TaskSchedulerStatus
    {
        return $this->status;
    }

    public function setStatus(TaskSchedulerStatus $status): void
    {
        $this->status = $status;
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

    public function getResult(): ?TaskSchedulerExecuteResult
    {
        return $this->result;
    }

    public function setResult(?TaskSchedulerExecuteResult $result): void
    {
        $this->result = $result;
    }
}
