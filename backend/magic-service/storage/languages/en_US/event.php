<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // Delivery
    'delivery_failed' => 'Event delivery failed',
    'publisher_not_found' => 'Event publisher not found',
    'exchange_not_found' => 'Event exchange not found',
    'routing_key_invalid' => 'Event routing key is invalid',

    // Consumer
    'consumer_execution_failed' => 'Event consumer execution failed',
    'consumer_not_found' => 'Event consumer not found',
    'consumer_timeout' => 'Event consumer timeout',
    'consumer_retry_exceeded' => 'Event consumer retry exceeded',
    'consumer_validation_failed' => 'Event consumer validation failed',

    // Data
    'data_serialization_failed' => 'Event data serialization failed',
    'data_deserialization_failed' => 'Event data deserialization failed',
    'data_validation_failed' => 'Event data validation failed',
    'data_format_invalid' => 'Event data format invalid',

    // Queue
    'queue_connection_failed' => 'Event queue connection failed',
    'queue_not_found' => 'Event queue not found',
    'queue_full' => 'Event queue is full',
    'queue_permission_denied' => 'Event queue permission denied',

    // Processing
    'processing_interrupted' => 'Event processing interrupted',
    'processing_deadlock' => 'Event processing deadlock',
    'processing_resource_exhausted' => 'Event processing resource exhausted',
    'processing_dependency_failed' => 'Event processing dependency failed',

    // Configuration
    'configuration_invalid' => 'Event configuration invalid',
    'handler_not_registered' => 'Event handler not registered',
    'listener_registration_failed' => 'Event listener registration failed',

    // System
    'system_unavailable' => 'Event system unavailable',
    'system_overloaded' => 'Event system overloaded',
    'system_maintenance' => 'Event system maintenance',

    // Business
    'points' => [
        'insufficient' => 'Insufficient points',
    ],
    'task' => [
        'pending' => 'Task is pending',
        'stop' => 'Task is stopped',
    ],
    'credit' => [
        'insufficient_limit' => 'Insufficient credit limit',
    ],
];
