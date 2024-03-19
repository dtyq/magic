<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Cron\CronExpression;
use DateTime;

class RoutineConfig
{
    private string $crontabRule = '';

    public function __construct(
        // 定时类型
        private readonly RoutineType $type,
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
        // 话题配置
        private readonly ?TopicConfig $topicConfig = null
    ) {
        // 保存配置时不再强行检测，放到生成规则处检测
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
            'topic' => $this->topicConfig?->toConfigArray() ?? [],
        ];
    }

    public function getDatetime(): DateTime
    {
        return new DateTime($this->day . ' ' . $this->time);
    }

    public function getCrontabRule(): string
    {
        if (! empty($this->crontabRule)) {
            return $this->crontabRule;
        }
        if ($this->type === RoutineType::NoRepeat) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '当前类型无需生成定时规则');
        }
        $minute = $hour = $dayOfMonth = $month = $dayOfWeek = '*';
        if (! empty($this->time)) {
            $hour = date('H', strtotime($this->time));
            $minute = date('i', strtotime($this->time));
        }

        switch ($this->type) {
            case RoutineType::DailyRepeat:
                break;
            case RoutineType::WeeklyRepeat:
                // 0-6 表示周一到周日，所以得兼容一下 crontab 的规则 0 表示周日
                $dayOfWeek = (int) $this->day + 1;
                if ($dayOfWeek === 7) {
                    $dayOfWeek = 0;
                }
                break;
            case RoutineType::MonthlyRepeat:
                $dayOfMonth = (int) $this->day;
                break;
            case RoutineType::AnnuallyRepeat:
                $dayOfMonth = date('d', strtotime($this->day));
                $month = date('m', strtotime($this->day));
                break;
            case RoutineType::WeekdayRepeat:
                $dayOfWeek = '1-5';
                break;
            case RoutineType::CustomRepeat:
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
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '生成定时规则失败');
        }
        return $this->crontabRule;
    }

    public function getType(): RoutineType
    {
        return $this->type;
    }

    public function getDeadline(): ?DateTime
    {
        return $this->deadline;
    }

    public function validate(): void
    {
        if (! empty($this->values)) {
            $this->values = array_values(array_unique($this->values));
        }
        if ($this->type === RoutineType::CustomRepeat) {
            if (empty($this->unit)) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '自定义周期间隔单位 不能为空');
            }
            if (empty($this->interval)) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '自定义周期间隔频率 不能为空');
            }
            // 只有每天的时候，才能自定义 interval，其余都是 1
            if (in_array($this->unit, [IntervalUnit::Week, IntervalUnit::Month, IntervalUnit::Year])) {
                $this->interval = 1;
            }
            if ($this->interval < 1 || $this->interval > 30) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '自定义周期间隔频率 只能在1~30之间');
            }
            // 只有是周或者月的时候，才能有 values
            if (in_array($this->unit, [IntervalUnit::Week, IntervalUnit::Month])) {
                if (empty($this->values)) {
                    ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '自定义周期间隔频率 不能为空');
                }
                if ($this->unit === IntervalUnit::Week) {
                    foreach ($this->values as $value) {
                        if (! is_int($value)) {
                            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '自定义周期间隔频率 只能是整数');
                        }
                        if ($value < 0 || $value > 6) {
                            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '自定义周期间隔频率 只能在0~6之间');
                        }
                    }
                }
                if ($this->unit === IntervalUnit::Month) {
                    foreach ($this->values as $value) {
                        if (! is_int($value)) {
                            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '自定义周期间隔频率 只能是整数');
                        }
                        if ($value < 1 || $value > 31) {
                            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '自定义周期间隔频率 只能在1~31之间');
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
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '日期 不能为空');
        }
        if ($this->type->needTime() && is_null($this->time)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '时间 不能为空');
        }

        // 每周的时候，day 表示周几 0-6  0是周一
        if ($this->type === RoutineType::WeeklyRepeat) {
            if (! is_numeric($this->day) || $this->day < 0 || $this->day > 6) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '日期 只能在0~6之间');
            }
            $this->day = (string) ((int) $this->day);
        }

        // 每月的时候，day 表示第几天
        if ($this->type === RoutineType::MonthlyRepeat) {
            if (! is_numeric($this->day) || $this->day < 1 || $this->day > 31) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '日期 只能在1~31之间');
            }
            $this->day = (string) ((int) $this->day);
        }

        // 不重复、每年、每月的时候，day 表示日期
        if (in_array($this->type, [RoutineType::NoRepeat, RoutineType::AnnuallyRepeat])) {
            if (! is_string($this->day) || empty($this->day) || ! strtotime($this->day)) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '日期 格式错误');
            }
        }

        $dayTimestamp = strtotime($this->day ?? '');
        if ($dayTimestamp) {
            // 时间只能是未来的，有bug， 当天也会认为是未来的
            // if (! is_null($this->day) && $dayTimestamp < time()) {
            //
            //     ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '日期 不能是过去的');
            // }
            if (! is_null($this->time) && ! is_null($this->day) && strtotime($this->day . ' ' . $this->time) < time()) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '时间 不能是过去的');
            }
        }

        // 截止时间只能是未来的
        if (! is_null($this->deadline) && $this->deadline->getTimestamp() < time()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, '截止日期 不能是过去的');
        }
    }
}
