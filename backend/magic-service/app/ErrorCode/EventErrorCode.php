<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * Event error codes range: 6000-6999
 * Used for event delivery and consumption related errors.
 */
enum EventErrorCode: int
{
    // Event delivery errors
    #[ErrorMessage('event.delivery_failed')]
    case EVENT_DELIVERY_FAILED = 6000;

    #[ErrorMessage('event.publisher_not_found')]
    case EVENT_PUBLISHER_NOT_FOUND = 6001;

    #[ErrorMessage('event.exchange_not_found')]
    case EVENT_EXCHANGE_NOT_FOUND = 6002;

    #[ErrorMessage('event.routing_key_invalid')]
    case EVENT_ROUTING_KEY_INVALID = 6003;

    // Event consumption errors
    #[ErrorMessage('event.consumer_execution_failed')]
    case EVENT_CONSUMER_EXECUTION_FAILED = 6100;

    #[ErrorMessage('event.consumer_not_found')]
    case EVENT_CONSUMER_NOT_FOUND = 6101;

    #[ErrorMessage('event.consumer_timeout')]
    case EVENT_CONSUMER_TIMEOUT = 6102;

    #[ErrorMessage('event.consumer_retry_exceeded')]
    case EVENT_CONSUMER_RETRY_EXCEEDED = 6103;

    #[ErrorMessage('event.consumer_validation_failed')]
    case EVENT_CONSUMER_VALIDATION_FAILED = 6104;

    // Event data errors
    #[ErrorMessage('event.data_serialization_failed')]
    case EVENT_DATA_SERIALIZATION_FAILED = 6200;

    #[ErrorMessage('event.data_deserialization_failed')]
    case EVENT_DATA_DESERIALIZATION_FAILED = 6201;

    #[ErrorMessage('event.data_validation_failed')]
    case EVENT_DATA_VALIDATION_FAILED = 6202;

    #[ErrorMessage('event.data_format_invalid')]
    case EVENT_DATA_FORMAT_INVALID = 6203;

    // Event queue errors
    #[ErrorMessage('event.queue_connection_failed')]
    case EVENT_QUEUE_CONNECTION_FAILED = 6300;

    #[ErrorMessage('event.queue_not_found')]
    case EVENT_QUEUE_NOT_FOUND = 6301;

    #[ErrorMessage('event.queue_full')]
    case EVENT_QUEUE_FULL = 6302;

    #[ErrorMessage('event.queue_permission_denied')]
    case EVENT_QUEUE_PERMISSION_DENIED = 6303;

    // Event processing errors
    #[ErrorMessage('event.processing_interrupted')]
    case EVENT_PROCESSING_INTERRUPTED = 6400;

    #[ErrorMessage('event.processing_deadlock')]
    case EVENT_PROCESSING_DEADLOCK = 6401;

    #[ErrorMessage('event.processing_resource_exhausted')]
    case EVENT_PROCESSING_RESOURCE_EXHAUSTED = 6402;

    #[ErrorMessage('event.processing_dependency_failed')]
    case EVENT_PROCESSING_DEPENDENCY_FAILED = 6403;

    // Event configuration errors
    #[ErrorMessage('event.configuration_invalid')]
    case EVENT_CONFIGURATION_INVALID = 6500;

    #[ErrorMessage('event.handler_not_registered')]
    case EVENT_HANDLER_NOT_REGISTERED = 6501;

    #[ErrorMessage('event.listener_registration_failed')]
    case EVENT_LISTENER_REGISTRATION_FAILED = 6502;

    // Event system errors
    #[ErrorMessage('event.system_unavailable')]
    case EVENT_SYSTEM_UNAVAILABLE = 6600;

    #[ErrorMessage('event.system_overloaded')]
    case EVENT_SYSTEM_OVERLOADED = 6601;

    #[ErrorMessage('event.system_maintenance')]
    case EVENT_SYSTEM_MAINTENANCE = 6602;

    #[ErrorMessage('event.points.insufficient')]
    case EVENT_POINTS_INSUFFICIENT = 6603;

    #[ErrorMessage('event.task.pending')]
    case EVENT_TASK_PENDING = 6604;

    #[ErrorMessage('event.task.stop')]
    case EVENT_TASK_STOP = 6605;

    #[ErrorMessage('event.credit.insufficient_limit')]
    case EVENT_CREDIT_INSUFFICIENT_LIMIT = 6606;
}
