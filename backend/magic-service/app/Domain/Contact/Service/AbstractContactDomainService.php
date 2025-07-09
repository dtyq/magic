<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service;

use App\Domain\Authentication\Service\PasswordService;
use App\Domain\Chat\Repository\Facade\MagicChatConversationRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatFileRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatSeqRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatTopicRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicContactIdMappingRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicFriendRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicMessageRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\MagicContactIdMappingRepository;
use App\Domain\Contact\Repository\Facade\MagicAccountRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicDepartmentRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicUserIdRelationRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowAIModelRepositoryInterface;
use App\Domain\Group\Repository\Facade\MagicGroupRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Facade\EnvironmentRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationsEnvironmentRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationsPlatformRepositoryInterface;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Infrastructure\ExternalAPI\Sms\SmsInterface;
use App\Infrastructure\ExternalAPI\Sms\TemplateInterface;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\Locker\RedisLocker;
use Hyperf\Amqp\Producer;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Hyperf\Snowflake\IdGeneratorInterface;
use Psr\Log\LoggerInterface;
use Throwable;

abstract class AbstractContactDomainService
{
    public function __construct(
        protected MagicUserRepositoryInterface $userRepository,
        protected IdGeneratorInterface $idGenerator,
        protected Redis $redis,
        protected SmsInterface $sms,
        protected TemplateInterface $template,
        protected MagicAccountRepositoryInterface $accountRepository,
        protected LockerInterface $locker,
        protected PasswordService $passwordService,
        protected MagicMessageRepositoryInterface $magicMessageRepository,
        protected MagicChatSeqRepositoryInterface $magicSeqRepository,
        protected MagicAccountRepositoryInterface $magicAccountRepository,
        protected MagicChatConversationRepositoryInterface $magicConversationRepository,
        protected RedisLocker $redisLocker,
        protected Producer $producer,
        protected MagicChatTopicRepositoryInterface $magicChatTopicRepository,
        protected MagicGroupRepositoryInterface $magicGroupRepository,
        protected MagicChatFileRepositoryInterface $magicFileRepository,
        protected readonly MagicFriendRepositoryInterface $friendRepository,
        protected readonly MagicUserIdRelationRepositoryInterface $userIdRelationRepository,
        protected readonly MagicContactIdMappingRepositoryInterface $contactThirdPlatformIdMappingRepository,
        protected readonly MagicContactIdMappingRepository $contactIdMappingRepository,
        protected readonly OrganizationsEnvironmentRepositoryInterface $magicOrganizationsEnvironmentRepository,
        protected readonly MagicTokenRepositoryInterface $magicTokenRepository,
        protected readonly EnvironmentRepositoryInterface $magicEnvironmentsRepository,
        protected readonly MagicFlowAIModelRepositoryInterface $magicFlowAIModelRepository,
        protected LoggerInterface $logger,
        protected MagicDepartmentUserRepositoryInterface $departmentUserRepository,
        protected readonly MagicContactIdMappingRepositoryInterface $thirdPlatformIdMappingRepository,
        protected readonly MagicDepartmentRepositoryInterface $departmentRepository,
        protected CloudFileRepositoryInterface $cloudFileRepository,
        protected readonly OrganizationsPlatformRepositoryInterface $organizationsPlatformRepository,
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(get_class($this));
        } catch (Throwable) {
        }
    }
}
