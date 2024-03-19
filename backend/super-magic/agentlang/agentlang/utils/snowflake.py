"""
雪花算法服务模块，提供生成唯一ID的功能
"""

import random
import time
from typing import Optional

from agentlang.logger import get_logger

logger = get_logger(__name__)


class Snowflake:
    """
    雪花算法（Snowflake）ID生成器

    该算法生成的ID结构如下（64位）:
    0 - 符号位，恒为0
    1~41 - 时间戳（毫秒级），占41位，可用约69年
    42~51 - 工作机器ID，占10位，最多支持1024个节点
    52~63 - 序列号，占12位，同一毫秒内最多生成4096个ID

    参考JavaScript实现，使用随机机器ID和以2021年为基准的时间偏移量。

    Attributes:
        machine_id: 机器ID (0-1023)
        sequence: 序列号 (0-4095)
        last_timestamp: 上次生成ID的时间戳
        offset: 时间戳偏移量，默认为2021年1月1日的时间戳
    """

    # 各部分占用的位数
    MACHINE_ID_BITS = 10
    SEQUENCE_BITS = 12

    # 最大值
    MAX_MACHINE_ID = -1 ^ (-1 << MACHINE_ID_BITS)  # 1023
    MAX_SEQUENCE = -1 ^ (-1 << SEQUENCE_BITS)  # 4095

    # 偏移量
    MACHINE_ID_SHIFT = SEQUENCE_BITS  # 12
    TIMESTAMP_SHIFT = SEQUENCE_BITS + MACHINE_ID_BITS  # 22

    # 默认起始时间戳：2021年1月1日 00:00:00 UTC
    DEFAULT_OFFSET = (2021 - 1970) * 365 * 24 * 3600 * 1000

    def __init__(self, machine_id: Optional[int] = None, offset: Optional[int] = None):
        """
        初始化雪花ID生成器

        Args:
            machine_id: 机器ID (0-1023)，默认为随机值
            offset: 时间戳偏移量，默认为2021年1月1日的时间戳

        Raises:
            ValueError: 如果machine_id超出范围
        """
        # 如果未提供machine_id，则生成随机的machine_id
        if machine_id is None:
            machine_id = random.randint(0, self.MAX_MACHINE_ID)

        if machine_id > self.MAX_MACHINE_ID or machine_id < 0:
            raise ValueError(f"machine_id不能大于{self.MAX_MACHINE_ID}或小于0")

        self.machine_id = machine_id
        self.sequence = 0
        self.last_timestamp = -1

        # 如果未提供offset，则使用默认值
        self.offset = offset if offset is not None else self.DEFAULT_OFFSET

        logger.info(f"Snowflake ID 生成器初始化成功，machine_id: {machine_id}, offset: {self.offset}")

    def _get_next_timestamp(self, last_timestamp: int) -> int:
        """
        获取下一个时间戳，如果当前时间戳小于等于上次的时间戳，则等待

        Args:
            last_timestamp: 上次生成ID的时间戳

        Returns:
            int: 新的时间戳
        """
        timestamp = self._get_time()
        while timestamp <= last_timestamp:
            timestamp = self._get_time()
        return timestamp

    def _get_time(self) -> int:
        """
        获取当前时间戳（毫秒）

        Returns:
            int: 当前时间戳
        """
        return int(time.time() * 1000)

    def get_id(self) -> int:
        """
        生成下一个雪花算法ID

        Returns:
            int: 生成的唯一ID

        Raises:
            RuntimeError: 当时钟回拨时抛出异常
        """
        timestamp = self._get_time()

        # 时钟回拨检测
        if timestamp < self.last_timestamp:
            clock_backward = self.last_timestamp - timestamp
            logger.warning(f"时钟回拨检测: {clock_backward}毫秒")

            # 如果回拨时间小于5ms，可以等待
            if clock_backward < 5:
                time.sleep(clock_backward / 1000)
                timestamp = self._get_time()
            else:
                raise RuntimeError(f"时钟回拨，拒绝生成ID，回拨时间: {clock_backward}毫秒")

        # 如果是同一毫秒内，增加序列号
        if timestamp == self.last_timestamp:
            self.sequence = (self.sequence + 1) & self.MAX_SEQUENCE
            # 同一毫秒内序列号用完，等待下一毫秒
            if self.sequence == 0:
                timestamp = self._get_next_timestamp(self.last_timestamp)
        else:
            # 不同毫秒，序列号重置
            self.sequence = 0

        # 更新上次时间戳
        self.last_timestamp = timestamp

        # 生成ID
        snowflake_id = (
            ((timestamp - self.offset) << self.TIMESTAMP_SHIFT)
            | (self.machine_id << self.MACHINE_ID_SHIFT)
            | self.sequence
        )

        return snowflake_id

    @classmethod
    def parse_id(cls, snowflake_id: int, offset: Optional[int] = None) -> dict:
        """
        解析雪花算法ID，提取其中的时间戳、机器ID和序列号

        Args:
            snowflake_id: 雪花算法ID
            offset: 时间戳偏移量，默认为类默认值

        Returns:
            dict: 包含ID各部分信息的字典
        """
        if not isinstance(snowflake_id, int):
            raise ValueError("snowflake_id必须是整数")

        if offset is None:
            offset = cls.DEFAULT_OFFSET

        timestamp_bits = 41
        machine_id_bits = 10
        sequence_bits = 12

        sequence_mask = -1 ^ (-1 << sequence_bits)
        machine_id_mask = -1 ^ (-1 << machine_id_bits)

        sequence = snowflake_id & sequence_mask
        machine_id = (snowflake_id >> sequence_bits) & machine_id_mask
        timestamp = (snowflake_id >> (sequence_bits + machine_id_bits)) + offset

        # 转换为可读的时间
        time_obj = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(timestamp / 1000))

        return {"timestamp": timestamp, "datetime": time_obj, "machine_id": machine_id, "sequence": sequence}

    @classmethod
    def create_default(cls) -> "Snowflake":
        """
        创建使用默认配置的雪花算法服务实例

        Returns:
            Snowflake: 新的雪花算法ID生成器实例
        """
        # 生成一个随机的机器ID，类似于JavaScript中的Math.floor(Math.random() * 1e10)
        # 但是需要限制在有效范围内（0-1023）
        random_machine_id = random.randint(0, cls.MAX_MACHINE_ID)
        return cls(machine_id=random_machine_id) 