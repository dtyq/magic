<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

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
                    $errors[] = 'Day is required for no_repeat type';
                }
                if (empty($this->time)) {
                    $errors[] = 'Time is required for no_repeat type';
                }
                break;
            case 'daily_repeat':
                if (empty($this->time)) {
                    $errors[] = 'Time is required for daily_repeat type';
                }
                break;
            case 'weekly_repeat':
                if (empty($this->day)) {
                    $errors[] = 'Day is required for weekly_repeat type';
                }
                if (empty($this->time)) {
                    $errors[] = 'Time is required for weekly_repeat type';
                }
                // Validate day is between 0-6
                if (! empty($this->day) && (! is_numeric($this->day) || $this->day < 0 || $this->day > 6)) {
                    $errors[] = 'Day must be between 0-6 for weekly_repeat type';
                }
                break;
            case 'monthly_repeat':
                if (empty($this->day)) {
                    $errors[] = 'Day is required for monthly_repeat type';
                }
                if (empty($this->time)) {
                    $errors[] = 'Time is required for monthly_repeat type';
                }
                // Validate day is between 1-31
                if (! empty($this->day) && (! is_numeric($this->day) || $this->day < 1 || $this->day > 31)) {
                    $errors[] = 'Day must be between 1-31 for monthly_repeat type';
                }
                break;
            case 'annually_repeat':
                if (empty($this->day)) {
                    $errors[] = 'Day is required for annually_repeat type';
                }
                if (empty($this->time)) {
                    $errors[] = 'Time is required for annually_repeat type';
                }
                break;
            case 'weekday_repeat':
                if (empty($this->time)) {
                    $errors[] = 'Time is required for weekday_repeat type';
                }
                break;
            case 'custom_repeat':
                if (empty($this->day)) {
                    $errors[] = 'Day is required for custom_repeat type';
                }
                if (empty($this->time)) {
                    $errors[] = 'Time is required for custom_repeat type';
                }
                if (empty($this->value['unit'])) {
                    $errors[] = 'Unit is required for custom_repeat type';
                }
                if (empty($this->value['interval'])) {
                    $errors[] = 'Interval is required for custom_repeat type';
                }
                // Validate values for week and month units
                if (in_array($this->value['unit'] ?? '', ['week', 'month']) && empty($this->value['values'])) {
                    $errors[] = 'Values are required for week and month units in custom_repeat type';
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
}
