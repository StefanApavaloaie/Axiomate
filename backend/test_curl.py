import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post("http://localhost:8000/api/v1/ingest/", 
                json={"events": [{"event_id": "test-123", "event_name": "pipeline_tested", "occurred_at": "2024-03-30T12:00:00Z"}]},
                headers={"X-API-Key": "test_key_3477ebfce44747b982b446c556ed212f"}
            )
            print("Status:", r.status_code)
            print("Body:", r.text)
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
