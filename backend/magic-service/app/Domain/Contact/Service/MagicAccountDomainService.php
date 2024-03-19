<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service;

use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\GenderType;
use App\Domain\Contact\Entity\ValueObject\UserIdType;
use App\Domain\Contact\Entity\ValueObject\UserStatus;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Constants\SmsSceneType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\ExternalAPI\Sms\Enum\SignEnum;
use App\Infrastructure\ExternalAPI\Sms\Enum\SmsTypeEnum;
use App\Infrastructure\ExternalAPI\Sms\SmsStruct;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;
use Random\RandomException;
use RedisException;
use Swow\Exception;
use Throwable;

use function Hyperf\Config\config;

class MagicAccountDomainService extends AbstractContactDomainService
{
    public function getAccountByMagicIds(array $magicIds): array
    {
        return $this->accountRepository->getAccountByMagicIds($magicIds);
    }

    /**
     * @throws RedisException
     * @throws RandomException
     */
    public function sendVerificationCode(string $stateCode, string $phone, string $type): array
    {
        // 手机号是否可用检查
        $this->checkPhoneStatus($type, $stateCode, $phone);
        // 短信频率检查
        $this->checkSmsLimit($stateCode, $phone);
        $code = (string) random_int(100000, 999999);
        $variables = ['timeout' => 10, 'verification_code' => $code];
        $sign = SignEnum::DENG_TA;
        // 将业务场景类型 转为 短信类型
        $smsType = match ($type) {
            SmsSceneType::BIND_PHONE,
            SmsSceneType::CHANGE_PHONE,
            SmsSceneType::CHANGE_PASSWORD,
            SmsSceneType::REGISTER_ACCOUNT,
            SmsSceneType::ACCOUNT_LOGIN_ACTIVE => SmsTypeEnum::VERIFICATION_WITH_EXPIRATION->value,
            default => ''
        };
        // 根据 type 确定短信模板id
        $templateId = $this->template->getTemplateIdByTypeAndLanguage($smsType, LanguageEnum::ZH_CN->value);
        $sms = new SmsStruct($stateCode . $phone, $variables, $sign, $templateId);
        $sendResult = $this->sms->send($sms);
        //        $sendResult = new SendResult();
        //        $sendResult->setResult(0, $code);
        $key = $this->getSmsVerifyCodeKey($stateCode . $phone, $type);
        // 缓存验证码,后续验证用
        $this->redis->setex($key, 10 * 60, $code);
        return $sendResult->toArray();
    }

    /**
     * @throws RedisException
     */
    public function humanRegister(string $stateCode, string $phone, string $verifyCode, string $password): array
    {
        // 手机号检查
        $this->checkPhoneStatus(SmsSceneType::REGISTER_ACCOUNT, $stateCode, $phone);
        $key = $this->getSmsVerifyCodeKey($stateCode . $phone, SmsSceneType::REGISTER_ACCOUNT);
        $code = $this->redis->get($key);
        if ($code === false) {
            ExceptionBuilder::throw(UserErrorCode::VERIFY_CODE_HAS_EXPIRED);
        }
        if ($code !== $verifyCode) {
            ExceptionBuilder::throw(UserErrorCode::VERIFY_CODE_ERROR);
        }
        $userId = $this->idGenerator->generate();
        $time = date('Y-m-d H:i:s');

        // 使用SHA256加密密码
        $hashedPassword = $this->passwordService->hashPassword($password);

        $this->userRepository->insertUser([
            'id' => $userId,
            'state_code' => $stateCode,
            'mobile' => $phone,
            'password' => $hashedPassword,
            'user_type' => 0,
            'status' => 0,
            'gender' => 0,
            'description' => '',
            'created_at' => $time,
            'updated_at' => $time,
        ]);
        return ['user_id' => $userId];
    }

    public function addUserAndAccount(MagicUserEntity $userDTO, AccountEntity $accountDTO): void
    {
        // 判断账号是否存在
        $magicId = $accountDTO->getMagicId();
        if (empty($magicId) || empty($userDTO->getOrganizationCode())) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }
        $existsAccount = $this->accountRepository->getAccountInfoByMagicId($magicId);
        if ($existsAccount !== null) {
            $userEntity = $this->userRepository->getUserByAccountAndOrganization($magicId, $userDTO->getOrganizationCode());
            // 账号存在,且在该组织下已经生成了用户信息,直接返回
            if ($userEntity !== null) {
                $userDTO->setUserId($userEntity->getUserId());
                $userDTO->setNickname($userEntity->getNickname());
                $userDTO->setUserType(UserType::Human);
                return;
            }
        }
        // 加锁防止并发
        $key = sprintf('addUserAndAccount:%s', $magicId);
        if (! $this->locker->mutexLock($key, $magicId, 5)) {
            ExceptionBuilder::throw(UserErrorCode::CREATE_USER_TOO_FREQUENTLY);
        }
        Db::beginTransaction();
        try {
            if (! $existsAccount) {
                // 账号不存在,新增账号
                $accountEntity = $this->accountRepository->createAccount($accountDTO);
            } else {
                // 账号存在,但是该组织下没有用户信息
                $accountEntity = $existsAccount;
            }
            // 将生成的账号信息关联到userEntity
            $userDTO->setMagicId($accountEntity->getMagicId());
            $userEntity = $this->userRepository->getUserByAccountAndOrganization($magicId, $userDTO->getOrganizationCode());
            if ($userEntity && $userEntity->getUserId()) {
                $userDTO->setUserId($userEntity->getUserId());
                return;
            }
            // 生成组织下用户信息
            if (empty($userDTO->getUserId())) {
                // 确定user_id的生成规则
                $userId = $this->userRepository->getUserIdByType(UserIdType::UserId, $userDTO->getOrganizationCode());
                $userDTO->setUserId($userId);
                // 1.47x(10**-29) 概率下,user_id会重复,会被mysql唯一索引拦截,让用户重新登录一次就行.
                $this->userRepository->createUser($userDTO);
            }
            Db::commit();
        } catch (Throwable $exception) {
            Db::rollBack();
            throw $exception;
        } finally {
            $this->locker->release($key, $magicId);
        }
    }

    /**
     * @param AccountEntity $accountDTO 支持启用/禁用智能体
     * @throws Throwable
     */
    public function aiRegister(MagicUserEntity $userDTO, DataIsolation $dataIsolation, AccountEntity $accountDTO): MagicUserEntity
    {
        Db::beginTransaction();
        try {
            if (empty($userDTO->getNickname()) || empty($userDTO->getDescription())) {
                ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR);
            }
            $accountEntity = $this->accountRepository->getAccountInfoByAiCode($accountDTO->getAiCode());
            if ($accountEntity) {
                $userDTO->setMagicId($accountEntity->getMagicId());
                // 更新 ai 的昵称
                $accountEntity->setRealName($userDTO->getNickname());
                // 更新账号信息
                if ($accountDTO->getStatus() !== null) {
                    // 启用/禁用智能体
                    $accountEntity->setStatus($accountDTO->getStatus());
                }
                $this->accountRepository->saveAccount($accountEntity);
                // 更新账号在该组织下的用户信息
                $userEntity = $this->userRepository->getUserByAccountAndOrganization($accountEntity->getMagicId(), $dataIsolation->getCurrentOrganizationCode());
                if ($userEntity === null) {
                    # 账号存在,但是该组织下没有用户信息. 生成用户信息
                    $userEntity = $this->createUser($userDTO, $dataIsolation);
                } else {
                    // 账号和用户信息都存在,更新一下用户信息
                    $userEntity->setNickname($userDTO->getNickname());
                    $userEntity->setAvatarUrl($userDTO->getAvatarUrl());
                    $userEntity->setDescription($userDTO->getDescription());
                    $this->userRepository->saveUser($userEntity);
                }
                Db::commit();
                return $userEntity;
            }
            // 创建账号
            $extra = [
                'like_num' => 0,
                'friend_num' => 0,
                'label' => $userDTO->getLabel(),
                'description' => $userDTO->getDescription(),
            ];
            $accountDTO->setExtra(Json::encode($extra));
            $accountDTO->setCountryCode('+86');
            $accountDTO->setEmail('');
            $accountDTO->setGender(GenderType::Unknown);
            $accountDTO->setPhone($accountDTO->getAiCode());
            $accountDTO->setType(UserType::Ai);
            # 账号不存在(用户肯定也不存在),生成账号和用户信息
            $magicId = (string) IdGenerator::getSnowId();
            $accountDTO->setMagicId($magicId);
            $this->accountRepository->createAccount($accountDTO);
            $userDTO->setMagicId($magicId);
            // 为账号在当前组织创建用户
            $result = $this->createUser($userDTO, $dataIsolation);
            Db::commit();
            return $result;
        } catch (Exception $exception) {
            Db::rollBack();
            $this->logger->error('aiRegister error: ' . $exception->getMessage());
            throw $exception;
        } catch (Throwable $exception) {
            Db::rollBack();
            throw $exception;
        }
    }

    public function getAccountInfoByMagicId(string $magicId): ?AccountEntity
    {
        return $this->accountRepository->getAccountInfoByMagicId($magicId);
    }

    public function getAccountInfoByAiCode(string $aiCode): ?AccountEntity
    {
        return $this->accountRepository->getAccountInfoByAiCode($aiCode);
    }

    public function searchUserByPhoneOrRealName(string $query, DataIsolation $dataIsolation): array
    {
        $accounts = $this->accountRepository->searchUserByPhoneOrRealName($query);
        if (empty($accounts)) {
            return [];
        }
        $magicIds = array_column($accounts, 'magic_id');
        return $this->userRepository->getUserByAccountsAndOrganization($magicIds, $dataIsolation->getCurrentOrganizationCode());
    }

    /**
     * @return AccountEntity[]
     */
    public function getByMagicIds(array $magicIds): array
    {
        return $this->accountRepository->getAccountByMagicIds($magicIds);
    }

    public function getByMagicId(string $magicId): ?AccountEntity
    {
        return $this->accountRepository->getAccountInfoByMagicId($magicId);
    }

    /**
     * 修改用户密码
     */
    public function updatePassword(string $magicId, string $plainPassword): bool
    {
        if (! $this->getAccountInfoByMagicId($magicId)) {
            return false;
        }

        // 使用SHA256加密密码
        $hashedPassword = $this->passwordService->hashPassword($plainPassword);

        // 更新密码
        $this->accountRepository->updateAccount($magicId, [
            'password' => $hashedPassword,
        ]);

        return true;
    }

    private function createUser(MagicUserEntity $userDTO, DataIsolation $dataIsolation): MagicUserEntity
    {
        $userId = $this->userRepository->getUserIdByType(UserIdType::UserId, $dataIsolation->getCurrentOrganizationCode());
        $userDTO->setUserId($userId);
        $userDTO->setUserType(UserType::Ai);
        $userDTO->setLikeNum(0);
        $userDTO->setStatus(UserStatus::Activated);
        $userDTO->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        return $this->userRepository->createUser($userDTO);
    }

    private function getSmsDayCountKey(string $stateCodePhoneNumber): string
    {
        return 'sms.day_count.' . $stateCodePhoneNumber;
    }

    private function getSmsLastSendTimeKey(string $stateCodePhoneNumber): string
    {
        return 'sms.last_send_time.' . $stateCodePhoneNumber;
    }

    private function getSmsVerifyCodeKey(string $stateCodePhoneNumber, string $type): string
    {
        return 'sms.verify_code.' . $stateCodePhoneNumber . $type;
    }

    private function checkPhoneStatus(string $type, string $stateCode, string $phone): void
    {
        $mobile = $this->userRepository->getUserByMobileWithStateCode($stateCode, $phone);
        if ($mobile && in_array($type, [SmsSceneType::REGISTER_ACCOUNT, SmsSceneType::BIND_PHONE], true)) {
            ExceptionBuilder::throw(UserErrorCode::PHONE_HAS_REGISTER);
        }
        if (! $mobile && in_array($type, [SmsSceneType::CHANGE_PHONE, SmsSceneType::CHANGE_PASSWORD], true)) {
            ExceptionBuilder::throw(UserErrorCode::PHONE_NOT_BIND_USER);
        }
    }

    /**
     * @throws RedisException
     */
    private function checkSmsLimit(string $stateCode, string $phone): void
    {
        // 短信发送频率控制
        $timeInterval = config('sms.time_interval') ?: 60;
        $lastSendTimeKey = $this->getSmsLastSendTimeKey($stateCode . $phone);
        $setSuccess = $this->redis->set($lastSendTimeKey, '1', ['nx', 'ex' => $timeInterval]);
        if (! $setSuccess) {
            ExceptionBuilder::throw(UserErrorCode::SMS_RATE_LIMIT);
        }
        $dayMaxCountKey = $this->getSmsDayCountKey($stateCode . $phone);
        $count = (int) $this->redis->get($dayMaxCountKey);
        $dayMaxCount = config('sms.day_max_count') ?: 30;
        if ($count > $dayMaxCount) {
            ExceptionBuilder::throw(UserErrorCode::SMS_RATE_LIMIT);
        }
    }
}
