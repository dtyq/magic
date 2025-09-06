<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Publish;

use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectForkEvent;
use Hyperf\Amqp\Annotation\Producer;
use Hyperf\Amqp\Message\ProducerMessage;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;

/**
 * Project fork message publisher.
 */
#[Producer(exchange: 'super_magic_project_fork', routingKey: 'super_magic_project_fork')]
class ProjectForkPublisher extends ProducerMessage
{
    /**
     * Constructor.
     */
    public function __construct(ProjectForkEvent $event)
    {
        $this->payload = $event->toArray();

        // Set AMQP message properties, including original timestamp
        $this->properties = [
            'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT, // Keep message persistent
            'application_headers' => new AMQPTable([
                'x-original-timestamp' => time(), // Set original timestamp (seconds)
                'x-event-type' => 'project_fork', // Set event type for routing and monitoring
                'x-organization-code' => $event->getOrganizationCode(), // Set organization code
                'x-user-id' => $event->getUserId(), // Set user ID
                'x-source-project-id' => $event->getSourceProjectId(), // Set source project ID
                'x-fork-project-id' => $event->getForkProjectId(), // Set fork project ID
            ]),
        ];
    }
}
