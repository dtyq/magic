"""Datetime formatting utilities"""
from datetime import datetime


def get_current_datetime_str() -> str:
    """Get current datetime as formatted string for LLM context

    Returns:
        Formatted datetime string in English, e.g., "2025-12-02 16:43:54 Tuesday (Week 48)"
    """
    now = datetime.now()
    weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekday_name = weekday_names[now.weekday()]
    return now.strftime(f"%Y-%m-%d %H:%M:%S {weekday_name} (Week %W)")
