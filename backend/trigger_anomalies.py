import asyncio
import sys
from datetime import date
from sqlalchemy import select, insert
from app.db.session import AsyncSessionLocal
from app.models.workspace import Workspace
from app.models.anomaly import Anomaly
from app.workers.anomaly_tasks import _detect_all_workspaces

async def trigger_and_inject():
    print("Running background anomaly detection...")
    await _detect_all_workspaces()
    
    # We also manually inject one critical anomaly so there's always something to see in the UI
    print("Injecting one test anomaly for UI visualization...")
    async with AsyncSessionLocal() as db:
        ws_res = await db.execute(select(Workspace.id))
        ws_id = ws_res.scalars().first()
        
        if ws_id:
            db.add(Anomaly(
                workspace_id=ws_id,
                event_name="checkout_started",
                detected_date=date.today(),
                metric="daily_volume",
                expected_value=45.2,
                actual_value=12.0,
                z_score=-4.5,
                severity="critical"
            ))
            await db.commit()
            print("Done! You can verify anomalies in the frontend Settings/Dashboard.")

if __name__ == "__main__":
    asyncio.run(trigger_and_inject())
