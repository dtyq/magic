<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe;

use App\Application\Chat\Service\FollowUpSuggestionAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\Context\CoContext;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicMessageSentSuccessEvent;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[AsyncListener]
#[Listener]
class FollowUpSuggestionGenerateSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly FollowUpSuggestionAppService $followUpSuggestionAppService,
        private readonly TranslatorInterface $translator,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function listen(): array
    {
        return [
            TopicMessageSentSuccessEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof TopicMessageSentSuccessEvent) {
            return;
        }

        try {
            if (! empty($event->getLanguage())) {
                CoContext::setLanguage($event->getLanguage());
                $this->translator->setLocale($event->getLanguage());
            }

            // 先生成一条保底数据库记录
            $dataIsolation = DataIsolation::simpleMake($event->getOrganizationCode(), $event->getUserId());
            $dataIsolation->setLanguage($event->getLanguage());
            $this->followUpSuggestionAppService->createSuperMagicTopicFollowUpGenerating(
                $event->getTaskId(),
                $event->getTopicId(),
                $event->getLanguage(),
                $event->getUserId() !== '' ? $event->getUserId() : null,
            );

            // 调用生成推荐问题
            $this->followUpSuggestionAppService->generateAndPersist(
                $dataIsolation,
                $event->getTopicId(),
                $event->getTaskId(),
            );
        } catch (Throwable $throwable) {
            $this->logger->error('generate follow-up suggestions failed', [
                'topic_id' => $event->getTopicId(),
                'task_id' => $event->getTaskId(),
                'error' => $throwable->getMessage(),
            ]);
        }
    }
}
