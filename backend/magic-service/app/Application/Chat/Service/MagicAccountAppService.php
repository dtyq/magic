<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\AccountStatus;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Random\RandomException;
use RedisException;
use Throwable;

class MagicAccountAppService extends AbstractAppService
{
    public function __construct(
        protected readonly MagicUserDomainService $userDomainService,
        protected readonly MagicAccountDomainService $accountDomainService,
        protected readonly LockerInterface $locker,
        protected readonly MagicFlowDomainService $magicFlowDomainService,
    ) {
    }

    /**
     * @throws RedisException
     */
    public function register(string $stateCode, string $phone, string $verifyCode, string $password): array
    {
        return $this->accountDomainService->humanRegister($stateCode, $phone, $verifyCode, $password);
    }

    public function addUserAndAccount(MagicUserEntity $userDTO, AccountEntity $accountDTO): void
    {
        $this->accountDomainService->addUserAndAccount($userDTO, $accountDTO);
    }

    /**
     * @throws RedisException
     * @throws RandomException
     */
    public function sendVerificationCode(string $stateCode, string $phone, string $type): array
    {
        return $this->accountDomainService->sendVerificationCode($stateCode, $phone, $type);
    }

    /**
     * @param null|AccountEntity $accountDTO 支持启用/禁用智能体
     * @throws Throwable
     */
    public function aiRegister(MagicUserEntity $userDTO, MagicUserAuthorization $authorization, string $aiCode, ?AccountEntity $accountDTO = null): MagicUserEntity
    {
        $userDTO->setAvatarUrl(FileAssembler::formatPath($userDTO->getAvatarUrl()));

        $spinLockKey = 'chat:aiRegister:lock:' . $aiCode;
        $spinLockKeyOwner = random_bytes(8);
        // 自旋锁
        $this->locker->spinLock($spinLockKey, $spinLockKeyOwner, 3);
        try {
            $userDTO->setUserType(UserType::Ai);
            if (empty($authorization->getMagicId()) && ! empty($authorization->getId())) {
                $magicInfo = $this->userDomainService->getUserById($authorization->getId());
                $authorization->setMagicId($magicInfo?->getMagicId());
                $authorization->setOrganizationCode($magicInfo?->getOrganizationCode());
            }
            // 通过 aiCode 查询 magic_flows 表获取所属组织。
            // 注意超级麦吉当前是作为一个没有写入 magic_flows 数据库的 flow 存在。 SUPER_MAGIC_CODE 写入了 accounts 表。
            if ($aiCode !== AgentConstant::SUPER_MAGIC_CODE) {
                $disabledDataIsolation = FlowDataIsolation::create()->disabled();
                $magicFlowEntity = $this->magicFlowDomainService->getByCode($disabledDataIsolation, $aiCode);
                if (! $magicFlowEntity) {
                    ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
                }
                $authorization->setOrganizationCode($magicFlowEntity->getOrganizationCode());
            }

            $dataIsolation = $this->createDataIsolation($authorization);
            // 智能体账号信息
            if (! isset($accountDTO)) {
                $accountDTO = new AccountEntity();
            }
            ! $accountDTO->getRealName() && $accountDTO->setRealName($userDTO->getNickname());
            ! $accountDTO->getAiCode() && $accountDTO->setAiCode($aiCode);
            ! $accountDTO->getStatus() && $accountDTO->setStatus(AccountStatus::Normal);
            return $this->accountDomainService->aiRegister($userDTO, $dataIsolation, $accountDTO);
        } finally {
            $this->locker->release($spinLockKey, $spinLockKeyOwner);
        }
    }

    public function loginByPhoneAndCode(string $mobile, string $code)
    {
        // 检查验证码是否正确
    }

    public function getAccountInfoByMagicId(string $magicId): ?AccountEntity
    {
        return $this->accountDomainService->getAccountInfoByMagicId($magicId);
    }
}
