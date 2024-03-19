"""
Message Schedule Result

Result class for message schedule (cron task) API response.
"""

from typing import Dict, Any, List, Optional
from app.infrastructure.sdk.base import AbstractResult


class MessageScheduleResult(AbstractResult):
    """定时消息任务创建结果"""

    def __init__(self, data: Dict[str, Any]):
        """
        初始化定时任务结果

        Args:
            data: API 返回的原始数据
        """
        super().__init__(data)

    def _parse_data(self) -> None:
        """解析原始数据到结构化属性"""
        self.schedule_id: Optional[str] = self.get('id') or self.get('schedule_id')
        self.task_name: Optional[str] = self.get('task_name')
        self.task_describe: Optional[str] = self.get('task_describe')
        self.message_content: Optional[str] = self.get('message_content')
        self.topic_id: Optional[str] = self.get('topic_id')
        self.model_id: Optional[str] = self.get('model_id')
        self.time_config: Optional[Dict[str, Any]] = self.get('time_config')
        self.status: Optional[str] = self.get('status')
        self.created_at: Optional[str] = self.get('created_at')
        self.updated_at: Optional[str] = self.get('updated_at')

    def get_schedule_id(self) -> Optional[str]:
        """获取定时任务 ID"""
        return self.schedule_id

    def get_task_name(self) -> str:
        """获取任务名称"""
        return self.task_name

    def get_task_describe(self) -> Optional[str]:
        """获取任务描述"""
        return self.task_describe

    def get_message_content(self) -> Optional[str]:
        """获取消息内容"""
        return self.message_content

    def get_topic_id(self) -> Optional[str]:
        """获取话题 ID"""
        return self.topic_id

    def get_model_id(self) -> Optional[str]:
        """获取模型 ID"""
        return self.model_id

    def get_time_config(self) -> Optional[Dict[str, Any]]:
        """获取时间配置"""
        return self.time_config

    def get_status(self) -> Optional[str]:
        """获取任务状态"""
        return self.status

    def get_created_at(self) -> Optional[str]:
        """获取创建时间"""
        return self.created_at

    def get_updated_at(self) -> Optional[str]:
        """获取更新时间"""
        return self.updated_at

    def is_success(self) -> bool:
        """判断任务是否创建成功（存在 schedule_id 即视为成功）"""
        return self.schedule_id is not None

    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典，只输出接口实际返回的非空字段

        Returns:
            结构化结果的字典表示
        """
        candidates = {
            'id': self.schedule_id,
            'task_name': self.task_name,
            'task_describe': self.task_describe,
            'message_content': self.message_content,
            'topic_id': self.topic_id,
            'model_id': self.model_id,
            'time_config': self.time_config,
            'status': self.status,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }
        return {k: v for k, v in candidates.items() if v is not None}

    def __str__(self) -> str:
        """字符串表示"""
        return f"MessageScheduleResult[{self.schedule_id}]: {self.task_name}"


class MessageScheduleListResult(AbstractResult):
    """定时消息任务列表查询结果"""

    def __init__(self, data: Dict[str, Any]):
        """
        初始化列表结果

        Args:
            data: API 返回的原始数据
        """
        super().__init__(data)

    def _parse_data(self) -> None:
        """解析原始数据到结构化属性"""
        self.total: int = self.get('total', 0)
        self.page: Optional[int] = self.get('page')
        self.page_size: Optional[int] = self.get('page_size')
        raw_list: List[Dict[str, Any]] = self.get('list', [])
        self.items: List[MessageScheduleResult] = [
            MessageScheduleResult(item) for item in raw_list
        ]

    def get_total(self) -> int:
        """获取总记录数"""
        return self.total

    def get_page(self) -> Optional[int]:
        """获取当前页码"""
        return self.page

    def get_page_size(self) -> Optional[int]:
        """获取每页数量"""
        return self.page_size

    def get_items(self) -> List[MessageScheduleResult]:
        """获取当前页的定时任务列表"""
        return self.items

    def is_success(self) -> bool:
        """判断查询是否成功"""
        return True

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典，只输出接口实际返回的字段"""
        result: Dict[str, Any] = {
            'total': self.total,
            'list': [item.to_dict() for item in self.items],
        }
        if self.page is not None:
            result['page'] = self.page
        if self.page_size is not None:
            result['page_size'] = self.page_size
        return result

    def __str__(self) -> str:
        """字符串表示"""
        return f"MessageScheduleListResult[total={self.total}]"


class DeleteMessageScheduleResult(AbstractResult):
    """删除定时消息任务结果"""

    def __init__(self, data: Dict[str, Any]):
        """
        初始化删除结果

        Args:
            data: API 返回的原始数据
        """
        super().__init__(data)

    def _parse_data(self) -> None:
        """解析原始数据到结构化属性"""
        self.deleted: bool = bool(self.get('deleted', True))

    def is_success(self) -> bool:
        """判断删除是否成功"""
        return self.deleted

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {'deleted': self.deleted}

    def __str__(self) -> str:
        """字符串表示"""
        return f"DeleteMessageScheduleResult[deleted={self.deleted}]"
