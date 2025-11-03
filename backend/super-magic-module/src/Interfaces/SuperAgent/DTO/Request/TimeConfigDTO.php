<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Carbon\Carbon;
use Exception;

use function Hyperf\Translation\__;

/**
 * Time configuration DTO.
 * Handles various time configuration types for message scheduling.
 */
class TimeConfigDTO extends AbstractRequestDTO
{
    /**
     * Task type.
     */
    public string $type = '';

    /**
     * Specific date.
     */
    public string $day = '';

    /**
     * Specific time.
     */
    public string $time = '';

    /**
     * Custom repeat value configuration.
     */
    public array $value = [];

    /**
     * Get task type.
     */
    public function getType(): string
    {
        return $this->type;
    }

    /**
     * Get day.
     */
    public function getDay(): string
    {
        return $this->day;
    }

    /**
     * Get time.
     */
    public function getTime(): string
    {
        return $this->time;
    }

    /**
     * Get value configuration.
     */
    public function getValue(): array
    {
        return $this->value;
    }

    /**
     * Convert to array format.
     */
    public function toArray(): array
    {
        return [
            'type' => $this->type,
            'day' => $this->day,
            'time' => $this->time,
            'value' => $this->value,
        ];
    }

    /**
     * Additional validation rules based on type.
     */
    public function validateByType(): array
    {
        $errors = [];

        switch ($this->type) {
            case 'no_repeat':
                if (empty($this->day)) {
                    $errors[] = __('validation.schedule_time.no_repeat.day_required');
                }
                if (empty($this->time)) {
                    $errors[] = __('validation.schedule_time.no_repeat.time_required');
                }

                // Validate time range for no_repeat type
                if (! empty($this->day) && ! empty($this->time)) {
                    $timeRangeError = $this->validateNoRepeatTimeRange();
                    if ($timeRangeError) {
                        $errors[] = $timeRangeError;
                    }
                }
                break;
            case 'daily_repeat':
                if (empty($this->time)) {
                    $errors[] = __('validation.schedule_time.daily_repeat.time_required');
                }
                break;
            case 'weekly_repeat':
                if (empty($this->day)) {
                    $errors[] = __('validation.schedule_time.weekly_repeat.day_required');
                }
                if (empty($this->time)) {
                    $errors[] = __('validation.schedule_time.weekly_repeat.time_required');
                }
                // Validate day is between 0-6
                if (! empty($this->day) && (! is_numeric($this->day) || $this->day < 0 || $this->day > 6)) {
                    $errors[] = __('validation.schedule_time.weekly_repeat.day_range');
                }
                break;
            case 'monthly_repeat':
                if (empty($this->day)) {
                    $errors[] = __('validation.schedule_time.monthly_repeat.day_required');
                }
                if (empty($this->time)) {
                    $errors[] = __('validation.schedule_time.monthly_repeat.time_required');
                }
                // Validate day is between 1-31
                if (! empty($this->day) && (! is_numeric($this->day) || $this->day < 1 || $this->day > 31)) {
                    $errors[] = __('validation.schedule_time.monthly_repeat.day_range');
                }
                break;
            case 'annually_repeat':
                if (empty($this->day)) {
                    $errors[] = __('validation.schedule_time.annually_repeat.day_required');
                }
                if (empty($this->time)) {
                    $errors[] = __('validation.schedule_time.annually_repeat.time_required');
                }
                break;
            case 'weekday_repeat':
                if (empty($this->time)) {
                    $errors[] = __('validation.schedule_time.weekday_repeat.time_required');
                }
                break;
            case 'custom_repeat':
                if (empty($this->day)) {
                    $errors[] = __('validation.schedule_time.custom_repeat.day_required');
                }
                if (empty($this->time)) {
                    $errors[] = __('validation.schedule_time.custom_repeat.time_required');
                }
                if (empty($this->value['unit'])) {
                    $errors[] = __('validation.schedule_time.custom_repeat.unit_required');
                }
                if (empty($this->value['interval'])) {
                    $errors[] = __('validation.schedule_time.custom_repeat.interval_required');
                }
                // Validate values for week and month units
                if (in_array($this->value['unit'] ?? '', ['week', 'month']) && empty($this->value['values'])) {
                    $errors[] = __('validation.schedule_time.custom_repeat.values_required');
                }
                break;
        }

        return $errors;
    }

    /**
     * Check if configuration is valid.
     */
    public function isValid(): bool
    {
        $errors = $this->validateByType();
        return empty($errors);
    }

    /**
     * Get validation errors.
     */
    public function getValidationErrors(): array
    {
        return $this->validateByType();
    }

    /**
     * Compare two time configurations to see if they are different.
     *
     * @param array $oldConfig Old time configuration
     * @param array $newConfig New time configuration
     * @return bool True if configurations are different, false if same
     */
    public static function isConfigChanged(array $oldConfig, array $newConfig): bool
    {
        // If new config is empty, no change
        if (empty($newConfig)) {
            return false;
        }

        // Compare type
        if (($oldConfig['type'] ?? '') !== ($newConfig['type'] ?? '')) {
            return true;
        }

        // Compare day
        if (($oldConfig['day'] ?? '') !== ($newConfig['day'] ?? '')) {
            return true;
        }

        // Compare time
        if (($oldConfig['time'] ?? '') !== ($newConfig['time'] ?? '')) {
            return true;
        }

        // Compare value array (for custom_repeat configurations)
        $oldValue = $oldConfig['value'] ?? [];
        $newValue = $newConfig['value'] ?? [];

        // Compare interval
        if (($oldValue['interval'] ?? null) !== ($newValue['interval'] ?? null)) {
            return true;
        }

        // Compare unit
        if (($oldValue['unit'] ?? '') !== ($newValue['unit'] ?? '')) {
            return true;
        }

        // Compare values array
        $oldValues = $oldValue['values'] ?? [];
        $newValues = $newValue['values'] ?? [];
        if (json_encode($oldValues) !== json_encode($newValues)) {
            return true;
        }

        // Compare deadline
        if (($oldValue['deadline'] ?? '') !== ($newValue['deadline'] ?? '')) {
            return true;
        }

        // No changes detected
        return false;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'type' => [
                'required',
                'string',
                'in:no_repeat,daily_repeat,weekly_repeat,monthly_repeat,annually_repeat,weekday_repeat,custom_repeat',
            ],
            'day' => 'nullable|string',
            'time' => ['nullable', 'string', 'regex:/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/'],
            'value' => 'nullable|array',
            'value.interval' => 'nullable|integer|min:1|max:30',
            'value.unit' => 'nullable|string|in:day,week,month,year',
            'value.values' => 'nullable|array',
            'value.deadline' => 'nullable|string|date',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'type.required' => 'Time configuration type cannot be empty',
            'type.string' => 'Time configuration type must be a string',
            'type.in' => 'Time configuration type must be one of: no_repeat, daily_repeat, weekly_repeat, monthly_repeat, annually_repeat, weekday_repeat, custom_repeat',
            'day.string' => 'Day must be a string',
            'time.string' => 'Time must be a string',
            'time.regex' => 'Time must be in HH:MM format',
            'value.array' => 'Value must be an array',
            'value.interval.integer' => 'Interval must be an integer',
            'value.interval.min' => 'Interval must be at least 1',
            'value.interval.max' => 'Interval cannot exceed 30',
            'value.unit.string' => 'Unit must be a string',
            'value.unit.in' => 'Unit must be one of: day, week, month, year',
            'value.values.array' => 'Values must be an array',
            'value.deadline.string' => 'Deadline must be a string',
            'value.deadline.date' => 'Deadline must be a valid date',
        ];
    }

    /**
     * Validate no_repeat type time range.
     * Check if scheduled time is in the future and at least 5 minutes from now.
     * Returns only the first error found (priority: past time > less than 5 minutes > invalid format).
     */
    private function validateNoRepeatTimeRange(): ?string
    {
        try {
            // Combine day and time into a Carbon instance
            $scheduledTime = Carbon::createFromFormat(
                'Y-m-d H:i',
                $this->day . ' ' . $this->time,
                'Asia/Shanghai'
            );

            // Get current time
            $now = Carbon::now('Asia/Shanghai');

            // Check if scheduled time is in the past (highest priority)
            if ($scheduledTime->lte($now)) {
                return __('validation.schedule_time.no_repeat.must_be_future');
            }

            // Check if scheduled time is at least 5 minutes from now
            $minimumTime = $now->copy()->addMinutes(5);
            if ($scheduledTime->lt($minimumTime)) {
                return __('validation.schedule_time.no_repeat.must_be_at_least_5_minutes');
            }
        } catch (Exception $e) {
            return __('validation.schedule_time.no_repeat.invalid_date_time_format');
        }

        return null;
    }
}
