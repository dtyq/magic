"""
Message Schedule Parameter

Parameter class for message schedule (cron task) API.
"""

from typing import Dict, Any, List, Optional
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class TimeConfig:
    """定时任务的时间配置"""

    # Open API 支持的调度类型
    TYPE_NO_REPEAT = 'no_repeat'          # 不重复，需要 day（YYYY-MM-DD）+ time
    TYPE_DAILY_REPEAT = 'daily_repeat'    # 每天，需要 time
    TYPE_WEEKLY_REPEAT = 'weekly_repeat'  # 每周，需要 day（0-6，0=周日）+ time
    TYPE_MONTHLY_REPEAT = 'monthly_repeat'  # 每月，需要 day（1-31）+ time

    def __init__(
        self,
        schedule_type: str,
        time: str,
        day: Optional[str] = None,
    ):
        """
        初始化时间配置（仅包含计划执行时间，不包含 deadline）

        Args:
            schedule_type: 调度类型，可选值见 TYPE_* 常量
            time: 执行时间，格式 'HH:MM'，如 '9:00'
            day: 日期/星期/日号，含义随类型不同：
                 - no_repeat:      具体日期，格式 'YYYY-MM-DD'
                 - weekly_repeat:  星期几，'0'=周日 ... '6'=周六
                 - monthly_repeat: 几号，'1'-'31'
                 - daily_repeat:   不需要
        """
        self.schedule_type = schedule_type
        self.time = time
        self.day = day

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典，仅包含 type、time、day"""
        data: Dict[str, Any] = {
            'type': self.schedule_type,
            'time': self.time,
        }
        if self.day is not None:
            data['day'] = self.day
        return data


class MessageScheduleParameter(MagicServiceAbstractParameter):
    """定时消息任务的请求参数"""

    def __init__(
        self,
        task_name: str,
        message_content: str,
        time_config: TimeConfig,
        topic_id: str,
        model_id: str,
        deadline: Optional[str] = None,
        specify_topic: int = 0,
    ):
        """
        初始化定时任务参数

        Args:
            task_name: 任务名称，如 '每日早报'
            message_content: 消息内容（任务指令）
            time_config: 时间配置对象（仅包含执行计划 type/time/day）
            topic_id: 话题 ID
            model_id: 模型 ID
            deadline: 截止日期，格式 'YYYY-MM-DD HH:MM:SS'，重复任务可选，到期后停止执行
            specify_topic: 是否指定话题，0=否，1=是，默认 0
        """
        super().__init__()
        self.task_name = task_name
        self.message_content = message_content
        self.time_config = time_config
        self.topic_id = topic_id
        self.model_id = model_id
        self.deadline = deadline
        self.specify_topic = specify_topic

    def get_task_name(self) -> str:
        """获取任务名称"""
        return self.task_name

    def get_message_content(self) -> str:
        """获取消息内容"""
        return self.message_content

    def get_time_config(self) -> TimeConfig:
        """获取时间配置"""
        return self.time_config

    def get_topic_id(self) -> str:
        """获取话题 ID"""
        return self.topic_id

    def get_model_id(self) -> str:
        """获取模型 ID"""
        return self.model_id

    def get_specify_topic(self) -> int:
        """获取是否指定话题，0=否，1=是"""
        return self.specify_topic

    def to_body(self) -> Dict[str, Any]:
        """
        转换为请求体

        Returns:
            请求体字典
        """
        body: Dict[str, Any] = {
            'task_name': self.task_name,
            'message_content': self.message_content,
            'time_config': self.time_config.to_dict(),
            'topic_id': self.topic_id,
            'model_id': self.model_id,
            'specify_topic': self.specify_topic,
        }
        if self.deadline is not None:
            body['deadline'] = self.deadline
        return body

    def to_query_params(self) -> Dict[str, Any]:
        """转换为查询参数（POST 请求不使用）"""
        return {}

    def validate(self) -> None:
        """
        校验参数

        Raises:
            ValueError: 必填字段缺失或类型不正确时抛出
        """
        super().validate()

        if not self.task_name:
            raise ValueError("task_name is required")

        if not isinstance(self.task_name, str):
            raise ValueError("task_name must be a string")

        if not self.message_content:
            raise ValueError("message_content is required")

        if not isinstance(self.message_content, str):
            raise ValueError("message_content must be a string")

        if not isinstance(self.time_config, TimeConfig):
            raise ValueError("time_config must be a TimeConfig instance")

        valid_types = {
            TimeConfig.TYPE_NO_REPEAT,
            TimeConfig.TYPE_DAILY_REPEAT,
            TimeConfig.TYPE_WEEKLY_REPEAT,
            TimeConfig.TYPE_MONTHLY_REPEAT,
        }
        if not self.time_config.schedule_type:
            raise ValueError("time_config.type is required")
        if self.time_config.schedule_type not in valid_types:
            raise ValueError(f"time_config.type must be one of: {', '.join(sorted(valid_types))}")

        if self.time_config.schedule_type != TimeConfig.TYPE_NO_REPEAT and not self.time_config.time:
            raise ValueError("time_config.time is required")
        if self.time_config.schedule_type == TimeConfig.TYPE_NO_REPEAT and not self.time_config.time:
            raise ValueError("time_config.time is required for no_repeat")

        if not self.topic_id:
            raise ValueError("topic_id is required")

        if not isinstance(self.topic_id, str):
            raise ValueError("topic_id must be a string")

        if not self.model_id:
            raise ValueError("model_id is required")

        if not isinstance(self.model_id, str):
            raise ValueError("model_id must be a string")

        if self.specify_topic not in (0, 1):
            raise ValueError("specify_topic must be 0 or 1")


class QueryMessageSchedulesParameter(MagicServiceAbstractParameter):
    """查询定时消息任务列表的请求参数"""

    def __init__(
        self,
        page: int = 1,
        page_size: int = 50,
        project_id: Optional[str] = None,
        task_name: Optional[str] = None,
        enabled: Optional[int] = None,
        completed: Optional[int] = None,
    ):
        """
        初始化查询参数

        Args:
            page: 页码，从 1 开始
            page_size: 每页数量
            project_id: 当前项目（project）ID，用于限定仅返回该项目下的定时任务
            task_name: 任务名称，模糊搜索
            enabled: 是否启用，1=启用 0=禁用
            completed: 是否已完成，1=已完成 0=未完成
        """
        super().__init__()
        self.page = page
        self.page_size = page_size
        self.project_id = project_id
        self.task_name = task_name
        self.enabled = enabled
        self.completed = completed

    def to_body(self) -> Dict[str, Any]:
        """GET 请求不使用请求体"""
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        """转换为查询参数"""
        params: Dict[str, Any] = {
            'page': self.page,
            'page_size': self.page_size,
        }
        if self.project_id is not None:
            params['project_id'] = self.project_id
        if self.task_name is not None:
            params['task_name'] = self.task_name
        if self.enabled is not None:
            params['enabled'] = self.enabled
        if self.completed is not None:
            params['completed'] = self.completed
        return params

    def validate(self) -> None:
        """校验参数"""
        super().validate()
        if not isinstance(self.page, int) or self.page < 1:
            raise ValueError("page must be a positive integer")
        if not isinstance(self.page_size, int) or self.page_size < 1:
            raise ValueError("page_size must be a positive integer")


class GetMessageScheduleDetailParameter(MagicServiceAbstractParameter):
    """获取定时消息任务详情的请求参数"""

    def __init__(self, schedule_id: str):
        """
        初始化详情查询参数

        Args:
            schedule_id: 定时任务 ID
        """
        super().__init__()
        self.schedule_id = schedule_id

    def get_schedule_id(self) -> str:
        """获取定时任务 ID"""
        return self.schedule_id

    def to_body(self) -> Dict[str, Any]:
        """GET 请求不使用请求体"""
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        """GET 详情不需要额外查询参数"""
        return {}

    def validate(self) -> None:
        """校验参数"""
        super().validate()
        if not self.schedule_id:
            raise ValueError("schedule_id is required")
        if not isinstance(self.schedule_id, str):
            raise ValueError("schedule_id must be a string")


class UpdateMessageScheduleParameter(MagicServiceAbstractParameter):
    """更新定时消息任务的请求参数"""

    def __init__(
        self,
        schedule_id: str,
        task_name: Optional[str] = None,
        message_content: Optional[str] = None,
        time_config: Optional[TimeConfig] = None,
        deadline: Optional[str] = None,
        enabled: Optional[int] = None,
    ):
        """
        初始化更新参数

        Args:
            schedule_id: 定时任务 ID（路径参数）
            task_name: 任务名称
            message_content: 消息内容（任务指令）
            time_config: 时间配置对象
            deadline: 截止日期，格式 'YYYY-MM-DD HH:MM:SS'，重复任务到期后停止执行
            enabled: 是否启用，1=启用 0=禁用
        """
        super().__init__()
        self.schedule_id = schedule_id
        self.task_name = task_name
        self.message_content = message_content
        self.time_config = time_config
        self.deadline = deadline
        self.enabled = enabled

    def get_schedule_id(self) -> str:
        """获取定时任务 ID"""
        return self.schedule_id

    def to_body(self) -> Dict[str, Any]:
        """转换为请求体，只包含非 None 的字段"""
        body: Dict[str, Any] = {}
        if self.task_name is not None:
            body['task_name'] = self.task_name
        if self.message_content is not None:
            body['message_content'] = self.message_content
        if self.time_config is not None:
            body['time_config'] = self.time_config.to_dict()
        if self.deadline is not None:
            body['deadline'] = self.deadline
        if self.enabled is not None:
            body['enabled'] = self.enabled
        return body

    def to_query_params(self) -> Dict[str, Any]:
        """PUT 请求不使用查询参数"""
        return {}

    def validate(self) -> None:
        """校验参数"""
        super().validate()
        if not self.schedule_id:
            raise ValueError("schedule_id is required")
        if not isinstance(self.schedule_id, str):
            raise ValueError("schedule_id must be a string")
        if self.time_config is not None and not isinstance(self.time_config, TimeConfig):
            raise ValueError("time_config must be a TimeConfig instance")


class DeleteMessageScheduleParameter(MagicServiceAbstractParameter):
    """删除定时消息任务的请求参数"""

    def __init__(self, schedule_id: str):
        """
        初始化删除参数

        Args:
            schedule_id: 定时任务 ID
        """
        super().__init__()
        self.schedule_id = schedule_id

    def get_schedule_id(self) -> str:
        """获取定时任务 ID"""
        return self.schedule_id

    def to_body(self) -> Dict[str, Any]:
        """DELETE 请求不使用请求体"""
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        """DELETE 请求不使用查询参数"""
        return {}

    def validate(self) -> None:
        """校验参数"""
        super().validate()
        if not self.schedule_id:
            raise ValueError("schedule_id is required")
        if not isinstance(self.schedule_id, str):
            raise ValueError("schedule_id must be a string")
