<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Audit\Listener;

use App\Domain\Audit\ResourceAccess\Entity\ResourceAccessLogEntity;
use App\Domain\Audit\ResourceAccess\Service\ResourceAccessLogDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\SlidesTemplate\Event\SlidesTemplateUsedEvent;
use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Event\SkillMarketInstalledEvent;
use App\Domain\SuperMagic\Skill\Event\SkillMarketUninstalledEvent;
use App\Domain\SuperMagic\Skill\Event\SkillUsedEvent;
use App\Domain\SuperMagic\Skill\Service\SkillMarketDomainService;
use App\Infrastructure\Util\Context\CoContext;
use DateTime;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

#[Listener]
class ResourceAccessLogListener implements ListenerInterface
{
    private const string SLIDES_TEMPLATE_RESOURCE_TYPE = 'slides_template';

    private const string SKILL_RESOURCE_TYPE = 'skill';

    private const string INSTALL_OPERATION = 'install';

    private const string UNINSTALL_OPERATION = 'uninstall';

    private LoggerInterface $logger;

    public function __construct(
        private readonly ContainerInterface $container
    ) {
        $this->logger = $this->container->get(LoggerFactory::class)->get('resource-access-log');
    }

    public function listen(): array
    {
        return [
            SlidesTemplateUsedEvent::class,
            SkillMarketInstalledEvent::class,
            SkillMarketUninstalledEvent::class,
            //            SkillUsedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        try {
            $this->logger->info('Resource access log processing started', [
                'event' => $event::class,
            ]);

            $entity = match (true) {
                $event instanceof SlidesTemplateUsedEvent => $this->buildSlidesTemplateEntity($event),
                $event instanceof SkillMarketInstalledEvent => $this->buildSkillEntity($event, self::INSTALL_OPERATION),
                $event instanceof SkillMarketUninstalledEvent => $this->buildSkillEntity($event, self::UNINSTALL_OPERATION),
                $event instanceof SkillUsedEvent => $this->buildSkillEntity($event, 'use'),
                default => null,
            };

            if ($entity === null) {
                return;
            }

            $this->container
                ->get(ResourceAccessLogDomainService::class)
                ->save($entity);
        } catch (Throwable $throwable) {
            $this->logger->error('Resource access log processing failed', [
                'event' => $event::class,
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
            ]);
        }
    }

    private function buildSlidesTemplateEntity(SlidesTemplateUsedEvent $event): ResourceAccessLogEntity
    {
        $template = $event->getTemplate();

        return (new ResourceAccessLogEntity())
            ->setOrganizationCode($event->getOrganizationCode())
            ->setUserId($event->getUserId())
            ->setUserName($event->getUserName())
            ->setActorType($this->resolveActorType($event->getSourceId()))
            ->setResourceType(self::SLIDES_TEMPLATE_RESOURCE_TYPE)
            ->setResourceCode($template->getCode())
            ->setResourceName($template->getLabel()[CoContext::getLanguage()] ?? null)
            ->setOperation('use')
            ->setSource($this->resolveSource($event->getSourceId()))
            ->setRequestId($event->getRequestId())
            ->setCreatedAt($this->createEventTime($event->getCallTime()))
            ->setContext($this->buildContext($event->getBusinessParams()));
    }

    private function buildSkillEntity(
        SkillMarketInstalledEvent|SkillMarketUninstalledEvent|SkillUsedEvent $event,
        string $operation
    ): ?ResourceAccessLogEntity {
        $isUsageEvent = $event instanceof SkillUsedEvent;
        $market = $isUsageEvent ? null : $this->findSkillMarket($event->skillMarketId);
        if (! $isUsageEvent && $market === null) {
            return null;
        }

        $organizationCode = $isUsageEvent ? $event->getOrganizationCode() : $event->organizationCode;
        $userId = $isUsageEvent ? $event->getUserId() : $event->operatorId;
        $userName = $isUsageEvent ? $event->getUserName() : '';
        $source = $isUsageEvent ? $event->getSourceId() : 'api';
        $requestId = $isUsageEvent ? $event->getRequestId() : null;

        return (new ResourceAccessLogEntity())
            ->setOrganizationCode($organizationCode)
            ->setUserId($userId)
            ->setUserName($userName)
            ->setActorType($this->resolveActorType($source))
            ->setResourceType(self::SKILL_RESOURCE_TYPE)
            ->setResourceCode($isUsageEvent ? $event->getSkillCode() : $market->getSkillCode())
            ->setResourceName($isUsageEvent ? null : $market->getI18nName(CoContext::getLanguage()))
            ->setOperation($operation)
            ->setSource($this->resolveSource($source))
            ->setRequestId($requestId)
            ->setCreatedAt($isUsageEvent ? $this->createEventTime($event->getCallTime()) : null)
            ->setContext($isUsageEvent ? $event->getBusinessParams() : []);
    }

    private function createEventTime(int $callTime): DateTime
    {
        return (new DateTime())->setTimestamp(intdiv($callTime, 1000));
    }

    private function findSkillMarket(string $skillMarketId): ?SkillMarketEntity
    {
        $id = (int) $skillMarketId;
        return $this->container
            ->get(SkillMarketDomainService::class)
            ->findByIds([$id])[$id] ?? null;
    }

    private function buildContext(array $businessParams): array
    {
        $mapping = [
            'source' => ['source'],
            'task_id' => ['task_id', 'magic_task_id'],
            'topic_id' => ['topic_id', 'magic_topic_id'],
            'project_id' => ['project_id'],
            'chat_topic_id' => ['chat_topic_id', 'magic_chat_topic_id'],
        ];

        $context = [];
        foreach ($mapping as $contextKey => $paramKeys) {
            foreach ($paramKeys as $paramKey) {
                $value = trim((string) ($businessParams[$paramKey] ?? ''));
                if ($value !== '') {
                    $context[$contextKey] = $value;
                    break;
                }
            }
        }

        return $context;
    }

    private function resolveActorType(string $sourceId): string
    {
        return trim($sourceId) === SourceId::SUPER_MAGIC_TOOL ? 'tool' : 'user';
    }

    private function resolveSource(string $sourceId): string
    {
        return trim($sourceId) ?: 'api';
    }
}
