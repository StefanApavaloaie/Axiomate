beat_schedule = {
    # fiecare 5 minute sa proceseze ce nu e procesat
    "process-events-every-5min":{
        "task": "workers.event_tasks.process_raw_events_all_workspaces",
        "schedule": crontab(minute="*/5"),
    },
    # rollup la 00:30 UTC
    "nightly-rollup":{
        "task": "workers.aggregation_tasks.rollup_all_workspaces",
        "schedule" :crontab(hour=0, minute=30),
    },
    # detectie de anomalii la 1:00 utc
    "anomaly-detection":{
        "task": "workers.aggregation_tasks.rollup_all_workspaces",
        "schedule": crontab(hour=1, minute=0),
    },
    # rapoarte zilnice la 8:00 UTC
    "daily-reports":{
        "task" : "workers.report_tasks.send_daily_summaries",
        "schedule": crontab(hour=8, minute=0),
    },
}