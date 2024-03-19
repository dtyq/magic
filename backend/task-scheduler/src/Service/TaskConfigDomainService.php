<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Service;

use Cron\CronExpression;
use DateTime;
use Dtyq\TaskScheduler\Entity\TaskSchedulerValue;
use Dtyq\TaskScheduler\Entity\ValueObject\IntervalUnit;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskType;
use Dtyq\TaskScheduler\Exception\TaskSchedulerParamsSchedulerException;
use InvalidArgumentException;

class TaskConfigDomainService
{
    private string $crontabRule = '';

    public function __construct(
        // 定时类型
        private readonly TaskType $type,
        // 具体日期
        private ?string $day = null,
        // 具体时间
        private readonly ?string $time = null,
        // 自定义周期的时候，间隔单位 day / week / month / year
        private ?IntervalUnit $unit = null,
        // 自定义周期的时候，间隔频率，如每天，每周，每月，每年
        private ?int $interval = null,
        // unit=week时为[1~7]，unit=month时为[1~31]
        private ?array $values = null,
        // 结束日期，该日期后不生成数据
        private readonly ?DateTime $deadline = null,
    ) {
        $this->validate();
    }

    public function toConfigArray(): array
    {
        return [
            'type' => $this->type->value,
            'day' => $this->day,
            'time' => $this->time,
            'value' => [
                'interval' => $this->interval,
                'unit' => $this->unit?->value,
                'values' => $this->values,
                'deadline' => $this->deadline?->format('Y-m-d H:i:s'),
            ],
        ];
    }

    public function getDatetime(): DateTime
    {
        return new DateTime($this->day . ' ' . $this->time);
    }

    // 传入参数判断是否需要不重复的定时任务
    public function getCrontabRule(bool $isNoRepeat = false): string
    {
        if (! empty($this->crontabRule)) {
            return $this->crontabRule;
        }
        if ($this->type === TaskType::NoRepeat && $isNoRepeat == false) {
            throw new InvalidArgumentException('当前类型无需生成定时规则');
        }
        $minute = $hour = $dayOfMonth = $month = $dayOfWeek = '*';
        if (! empty($this->time)) {
            $hour = date('H', strtotime($this->time));
            $minute = date('i', strtotime($this->time));
        }

        switch ($this->type) {
            case TaskType::DailyRepeat:
                break;
            case TaskType::WeeklyRepeat:
                // 0-6 表示周一到周日，所以得兼容一下 crontab 的规则 0 表示周日
                $dayOfWeek = (int) $this->day + 1;
                if ($dayOfWeek == 7) {
                    $dayOfWeek = 0;
                }
                break;
            case TaskType::MonthlyRepeat:
                $dayOfMonth = (int) $this->day;
                break;
            case TaskType::AnnuallyRepeat:
                $dayOfMonth = date('d', strtotime($this->day));
                $month = date('m', strtotime($this->day));
                break;
            case TaskType::WeekdayRepeat:
                $dayOfWeek = '1-5';
                break;
            case TaskType::CustomRepeat:
                if ($this->unit === IntervalUnit::Day) {
                    $dayOfMonth = '*/' . $this->interval;
                }
                if ($this->unit === IntervalUnit::Week) {
                    $dayOfWeek = implode(',', $this->values);
                }
                if ($this->unit === IntervalUnit::Month) {
                    $dayOfMonth = implode(',', $this->values);
                }
                if ($this->unit === IntervalUnit::Year) {
                    $dayOfMonth = date('d', strtotime($this->day));
                    $month = date('m', strtotime($this->day));
                }
                break;
            default:
        }

        $this->crontabRule = "{$minute} {$hour} {$dayOfMonth} {$month} {$dayOfWeek}";
        if (! CronExpression::isValidExpression($this->crontabRule)) {
            throw new InvalidArgumentException('生成定时规则失败');
        }
        return $this->crontabRule;
    }

    public function getType(): TaskType
    {
        return $this->type;
    }

    public function getDeadline(): ?DateTime
    {
        return $this->deadline;
    }

    public function getCustomRepeatTaskExpectTimes(TaskSchedulerValue $taskSchedulerValue)
    {
        $unitType = IntervalUnit::tryFrom($taskSchedulerValue->getUnit());
        if (! $unitType) {
            throw new TaskSchedulerParamsSchedulerException('间隔单位未找到');
        }

        // 根据截止时间 和当前时间 得出间隔多少天
        $deadline = $this->getDeadline();
        $time = new DateTime();

        // 如果单位是年，那么month 不能为空
        if ($unitType == IntervalUnit::Year && empty($taskSchedulerValue->getMonth())) {
            throw new TaskSchedulerParamsSchedulerException('自定义重复选择年份时，月份不能为空');
        }

        // 如果单位是年
        if ($unitType == IntervalUnit::Year && empty($deadline)) {
            // 未来10年
            $deadline = $time->modify('+10 years');
        } elseif (! $deadline) {
            // 未来两年
            $deadline = $time->modify('+2 years');
        }

        $days = $deadline->diff(new DateTime())->days;
        // 最多不能超过5年
        if ($days > 1825 && $unitType != IntervalUnit::Year) {
            throw new TaskSchedulerParamsSchedulerException('间隔时间不能超过5年');
        }
        // if ($days < $taskSchedulerValue->getInterval()) {
        //     throw new TaskSchedulerParamsSchedulerException('每日间隔时间不能超过截止时间');
        // }

        $number = 1;
        if ($taskSchedulerValue->getInterval() >= 1) {
            $time = new DateTime();
            switch ($unitType) {
                case IntervalUnit::Day:
                    ++$number;
                    $number += ceil($days / $taskSchedulerValue->getInterval());

                    break;
                case IntervalUnit::Week:
                    $weeks = $deadline->diff($time)->days / 7;
                    // if ($weeks < $taskSchedulerValue->getInterval()) {
                    //     throw new TaskSchedulerParamsSchedulerException('每周间隔时间不能超过或等于截止时间');
                    // }

                    $number += ceil($weeks / $taskSchedulerValue->getInterval());
                    break;
                case IntervalUnit::Month:
                    $months = $deadline->diff($time)->days / 30;
                    if ($taskSchedulerValue->getInterval() == 1) {
                        $months = $months + 1;
                    }
                    // if ($months < $taskSchedulerValue->getInterval()) {
                    //     throw new TaskSchedulerParamsSchedulerException('每月间隔时间不能超过或等于截止时间');
                    // }

                    $number += ceil($months / $taskSchedulerValue->getInterval());
                    break;
                case IntervalUnit::Year:
                    $years = $deadline->diff($time)->days / 365;

                    // if ($years < $taskSchedulerValue->getInterval()) {
                    //     throw new TaskSchedulerParamsSchedulerException('每年间隔时间不能超过或等于截止时间');
                    // }

                    $number += ceil($years / $taskSchedulerValue->getInterval());
                    break;
                default:
                    $number = 1;
            }
        }

        $expectTimes = [];
        for ($i = 0; $i < $number; ++$i) {
            switch ($unitType) {
                case IntervalUnit::Day:
                    $modify = (int) $taskSchedulerValue->getInterval() * $i;
                    $newExpectTime = clone $this->getDatetime()->modify("+{$modify} {$taskSchedulerValue->getUnit()}");
                    if ($newExpectTime->getTimestamp() < time()) {
                        break;
                    }
                    $expectTimes[] = clone $newExpectTime;
                    break;
                case IntervalUnit::Week:
                    $modify = (int) $taskSchedulerValue->getInterval() * $i;
                    $expectTime = $this->getDatetime()->modify("+{$modify} {$taskSchedulerValue->getUnit()}");
                    $expectTime = $expectTime->setTime((int) $this->getDatetime()->format('H'), (int) $this->getDatetime()->format('i'));
                    foreach ($taskSchedulerValue->getValues() as $value) {
                        switch ($value) {
                            case 1:
                                $value = TaskType::Monday->value;
                                break;
                            case 2:
                                $value = TaskType::Tuesday->value;
                                break;
                            case 3:
                                $value = TaskType::Wednesday->value;
                                break;
                            case 4:
                                $value = TaskType::Thursday->value;
                                break;
                            case 5:
                                $value = TaskType::Friday->value;
                                break;
                            case 6:
                                $value = TaskType::Saturday->value;
                                break;
                            case 0:
                                $value = TaskType::Sunday->value;
                                break;
                        }
                        $newExpectTime = clone $expectTime;
                        $newExpectTime->modify("{$value}");
                        $newExpectTime = $newExpectTime->setTime((int) $this->getDatetime()->format('H'), (int) $this->getDatetime()->format('i'));
                        if ($newExpectTime->getTimestamp() < time()) {
                            continue;
                        }

                        $expectTimes[] = clone $newExpectTime;
                    }
                    break;
                case IntervalUnit::Month:
                    $modify = (int) $taskSchedulerValue->getInterval() * $i;

                    $newExpectTime = clone $this->getDatetime()->modify("+{$modify} {$taskSchedulerValue->getUnit()}");
                    // 获取当月一共有多少天
                    $days = $newExpectTime->format('t');
                    foreach ($taskSchedulerValue->getValues() as $value) {
                        if ($value > $days) {
                            continue;
                        }

                        $newExpectTime = $newExpectTime->setDate((int) $newExpectTime->format('Y'), (int) $newExpectTime->format('m'), (int) $value);
                        if ($newExpectTime->getTimestamp() < time()) {
                            continue;
                        }
                        $expectTimes[] = clone $newExpectTime;
                    }

                    break;
                case IntervalUnit::Year:
                    $modify = (int) $taskSchedulerValue->getInterval() * $i;
                    $newExpectTime = clone $this->getDatetime()->modify("+{$modify} {$taskSchedulerValue->getUnit()}");
                    $year = $newExpectTime->format('Y');
                    $month = $taskSchedulerValue->getMonth();

                    foreach ($taskSchedulerValue->getValues() as $value) {
                        $newExpectTime = $newExpectTime->setDate((int) $year, (int) $month, (int) $value);
                        var_dump($newExpectTime);
                        if ($newExpectTime->getTimestamp() < time()) {
                            continue;
                        }
                        $expectTimes[] = clone $newExpectTime;
                    }

                    break;
                default:
                    break;
            }
        }

        $h = $this->getDatetime()->format('H');
        $i = $this->getDatetime()->format('i');

        $deadlineDate = clone $deadline->setTime((int) $h, (int) $i);

        // var_dump($expectTimes);
        // 如果期望时间大于截止时间，则删除
        foreach ($expectTimes as $key => $expectTime) {
            if ($expectTime->getTimestamp() > $deadlineDate->getTimestamp()) {
                unset($expectTimes[$key]);
            }
        }

        if (empty($expectTimes)) {
            throw new TaskSchedulerParamsSchedulerException('未能生成任何定时任务,请检查配置');
        }
        return $expectTimes;
    }

    private function validate(): void
    {
        if (! empty($this->values)) {
            $this->values = array_values(array_unique($this->values));
        }
        if ($this->type === TaskType::CustomRepeat) {
            if (empty($this->unit)) {
                throw new InvalidArgumentException('自定义周期间隔单位 不能为空');
            }
            if (empty($this->interval)) {
                throw new InvalidArgumentException('自定义周期间隔频率 不能为空');
            }

            if ($this->interval < 1 || $this->interval > 30) {
                throw new InvalidArgumentException('自定义周期间隔频率 只能在1~30之间');
            }
            // 只有是周或者月的时候，才能有 values
            if (in_array($this->unit, [IntervalUnit::Week, IntervalUnit::Month])) {
                if (empty($this->values)) {
                    throw new InvalidArgumentException('自定义周期间隔频率 不能为空');
                }
                if ($this->unit === IntervalUnit::Week) {
                    foreach ($this->values as $value) {
                        if (! is_int($value)) {
                            throw new InvalidArgumentException('自定义周期间隔频率 只能是整数');
                        }
                        if ($value < 0 || $value > 6) {
                            throw new InvalidArgumentException('自定义周期间隔频率 只能在0~6之间');
                        }
                    }
                }
                if ($this->unit === IntervalUnit::Month) {
                    foreach ($this->values as $value) {
                        if (! is_int($value)) {
                            throw new InvalidArgumentException('自定义周期间隔频率 只能是整数');
                        }
                        if ($value < 1 || $value > 31) {
                            throw new InvalidArgumentException('自定义周期间隔频率 只能在1~31之间');
                        }
                    }
                }
            } else {
                $this->values = null;
            }
        } else {
            $this->unit = null;
            $this->interval = null;
            $this->values = null;
        }
        if ($this->type->needDay() && is_null($this->day)) {
            throw new InvalidArgumentException('日期 不能为空');
        }
        if ($this->type->needTime() && is_null($this->time)) {
            throw new InvalidArgumentException('时间 不能为空');
        }

        // 每周的时候，day 表示周几 0-6  0是周一
        if ($this->type === TaskType::WeeklyRepeat) {
            if (! is_numeric($this->day) || $this->day < 0 || $this->day > 6) {
                throw new InvalidArgumentException('日期 只能在0~6之间');
            }
            $this->day = (string) ((int) $this->day);
        }

        // 每月的时候，day 表示第几天
        if ($this->type === TaskType::MonthlyRepeat) {
            if (! is_numeric($this->day) || $this->day < 1 || $this->day > 31) {
                throw new InvalidArgumentException('日期 只能在1~31之间');
            }
            $this->day = (string) ((int) $this->day);
        }

        // 不重复、每年、每月的时候，day 表示日期
        if (in_array($this->type, [TaskType::NoRepeat, TaskType::AnnuallyRepeat])) {
            if (! is_string($this->day) || empty($this->day) || ! strtotime($this->day)) {
                throw new InvalidArgumentException('日期 格式错误');
            }
        }

        $dayTimestamp = strtotime($this->day ?? '');

        if ($dayTimestamp) {
            // 时间只能是未来的，
            // TODO 有bug， 当天也会认为是未来的
            // if (! is_null($this->day) && $dayTimestamp < time()) {
            //
            //     ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '日期 不能是过去的');
            // }

            if (! is_null($this->time) && ! is_null($this->day)) {
                $dateTime = DateTime::createFromFormat('Y-m-d H:i', $this->day . ' ' . $this->time);
                if ($dateTime === false) {
                    throw new InvalidArgumentException('Invalid date/time format');
                }
                if ($dateTime->getTimestamp() < time() && $this->type != TaskType::CustomRepeat) {
                    throw new InvalidArgumentException('距离当前时间过于接近,请调整时间');
                }
            }
        }
        $deadlineTimeStamp = null;
        if (! empty($this->time) && ! empty($this->deadline)) {
            $deadline = DateTime::createFromFormat('Y-m-d H:i', $this->deadline->format('Y-m-d') . ' ' . $this->time);
            if ($deadline === false) {
                throw new InvalidArgumentException('截止日期 格式错误');
            }
            $deadlineTimeStamp = $deadline->getTimestamp();
        } elseif (! empty($this->deadline)) {
            $deadlineTimeStamp = $this->deadline->getTimestamp();
        }

        // 如果是自定义重复，并且没有设置截止时间，则默认两年
        if ($this->type == TaskType::CustomRepeat && empty($this->deadline)) {
            $deadline = new DateTime();
            $deadline->modify('+2 years');
            $deadlineTimeStamp = $deadline->getTimestamp();
        }

        // 截止时间只能是未来的
        if ($deadlineTimeStamp && $deadlineTimeStamp < time()) {
            throw new InvalidArgumentException('截止日期 距离当前时间过于接近,请调整时间');
        }
    }
}
