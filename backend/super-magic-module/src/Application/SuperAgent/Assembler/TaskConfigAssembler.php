<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Assembler;

use DateTime;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\TimeConfigDTO;
use Dtyq\TaskScheduler\Entity\ValueObject\IntervalUnit;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskType;
use Dtyq\TaskScheduler\Service\TaskConfigDomainService;

/**
 * Task Configuration Assembler.
 * Responsible for converting TimeConfigDTO to TaskConfigDomainService.
 */
class TaskConfigAssembler
{
    /**
     * Assemble TaskConfigDomainService from TimeConfigDTO.
     * 
     * @param TimeConfigDTO $timeConfigDTO Time configuration DTO
     * @return TaskConfigDomainService Domain service for task configuration
     * @throws \InvalidArgumentException When task type is invalid
     */
    public static function assembleFromDTO(TimeConfigDTO $timeConfigDTO): TaskConfigDomainService
    {
        // Validate DTO before assembly
        if (!$timeConfigDTO->isValid()) {
            $errors = $timeConfigDTO->getValidationErrors();
            throw new \InvalidArgumentException('Invalid time configuration: ' . implode(', ', $errors));
        }

        // Convert task type
        $taskType = TaskType::from($timeConfigDTO->getType());
        
        // Convert interval unit if provided
        $unit = null;
        $value = $timeConfigDTO->getValue();
        if (!empty($value['unit'])) {
            $unit = IntervalUnit::from($value['unit']);
        }

        // Convert deadline if provided
        $deadline = null;
        if (!empty($value['deadline'])) {
            $deadline = new DateTime($value['deadline']);
        }

        // Create and return TaskConfigDomainService
        return new TaskConfigDomainService(
            type: $taskType,
            day: $timeConfigDTO->getDay() ?: null,
            time: $timeConfigDTO->getTime() ?: null,
            unit: $unit,
            interval: $value['interval'] ?? null,
            values: $value['values'] ?? null,
            deadline: $deadline
        );
    }

    /**
     * Assemble TaskConfigDomainService from array configuration.
     * 
     * @param array $timeConfigArray Time configuration array
     * @return TaskConfigDomainService Domain service for task configuration
     * @throws \InvalidArgumentException When configuration is invalid
     */
    public static function assembleFromArray(array $timeConfigArray): TaskConfigDomainService
    {
        // Create DTO from array
        $timeConfigDTO = new TimeConfigDTO();
        $timeConfigDTO->type = $timeConfigArray['type'] ?? '';
        $timeConfigDTO->day = $timeConfigArray['day'] ?? '';
        $timeConfigDTO->time = $timeConfigArray['time'] ?? '';
        $timeConfigDTO->value = $timeConfigArray['value'] ?? [];

        // Use DTO assembly method
        return self::assembleFromDTO($timeConfigDTO);
    }

    /**
     * Validate time configuration before assembly.
     * 
     * @param TimeConfigDTO $timeConfigDTO Time configuration DTO
     * @return bool True if valid, false otherwise
     */
    public static function validateTimeConfig(TimeConfigDTO $timeConfigDTO): bool
    {
        return $timeConfigDTO->isValid();
    }

    /**
     * Get validation errors for time configuration.
     * 
     * @param TimeConfigDTO $timeConfigDTO Time configuration DTO
     * @return array Array of validation error messages
     */
    public static function getValidationErrors(TimeConfigDTO $timeConfigDTO): array
    {
        return $timeConfigDTO->getValidationErrors();
    }
}
