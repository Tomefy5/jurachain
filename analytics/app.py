import os
import duckdb
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn

app = FastAPI(title="JusticeAutomation Analytics Service", version="1.0.0")

# DuckDB connection
DUCKDB_PATH = os.getenv('DUCKDB_PATH', '/data/analytics.db')
conn = duckdb.connect(DUCKDB_PATH)

# Initialize database schema
def init_database():
    """Initialize the analytics database schema"""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS document_events (
            id UUID DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            document_id UUID,
            event_type VARCHAR NOT NULL,
            document_type VARCHAR,
            ai_service VARCHAR,
            duration_seconds FLOAT,
            status VARCHAR NOT NULL,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS blockchain_events (
            id UUID DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            document_id UUID,
            transaction_id VARCHAR,
            network VARCHAR NOT NULL,
            transaction_type VARCHAR NOT NULL,
            duration_seconds FLOAT,
            status VARCHAR NOT NULL,
            gas_used BIGINT,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            id UUID DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            session_start TIMESTAMP NOT NULL,
            session_end TIMESTAMP,
            ip_address VARCHAR,
            user_agent VARCHAR,
            actions_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

# Pydantic models
class DocumentEvent(BaseModel):
    user_id: str
    document_id: Optional[str] = None
    event_type: str
    document_type: Optional[str] = None
    ai_service: Optional[str] = None
    duration_seconds: Optional[float] = None
    status: str
    metadata: Optional[Dict[str, Any]] = None

class BlockchainEvent(BaseModel):
    user_id: str
    document_id: Optional[str] = None
    transaction_id: Optional[str] = None
    network: str
    transaction_type: str
    duration_seconds: Optional[float] = None
    status: str
    gas_used: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

class UserSession(BaseModel):
    user_id: str
    session_start: str
    session_end: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    actions_count: int = 0

@app.on_event("startup")
async def startup_event():
    init_database()

@app.get("/health")
async def health_check():
    return {"status": "OK", "service": "analytics"}

@app.post("/events/document")
async def record_document_event(event: DocumentEvent):
    """Record a document-related event"""
    try:
        conn.execute("""
            INSERT INTO document_events 
            (user_id, document_id, event_type, document_type, ai_service, duration_seconds, status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            event.user_id, event.document_id, event.event_type, 
            event.document_type, event.ai_service, event.duration_seconds,
            event.status, event.metadata
        ])
        return {"message": "Event recorded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/events/blockchain")
async def record_blockchain_event(event: BlockchainEvent):
    """Record a blockchain-related event"""
    try:
        conn.execute("""
            INSERT INTO blockchain_events 
            (user_id, document_id, transaction_id, network, transaction_type, duration_seconds, status, gas_used, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            event.user_id, event.document_id, event.transaction_id,
            event.network, event.transaction_type, event.duration_seconds,
            event.status, event.gas_used, event.metadata
        ])
        return {"message": "Event recorded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/user/{user_id}")
async def get_user_analytics(user_id: str):
    """Get comprehensive analytics for a specific user"""
    try:
        # Document statistics
        doc_stats = conn.execute("""
            SELECT 
                COUNT(*) as total_documents,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_documents,
                COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_documents,
                AVG(duration_seconds) as avg_generation_time,
                COUNT(CASE WHEN event_type = 'status_change' THEN 1 END) as status_changes
            FROM document_events 
            WHERE user_id = ?
        """, [user_id]).fetchone()
        
        # Document type distribution
        doc_types = conn.execute("""
            SELECT 
                document_type,
                COUNT(*) as count
            FROM document_events 
            WHERE user_id = ? AND document_type IS NOT NULL
            GROUP BY document_type
            ORDER BY count DESC
        """, [user_id]).fetchall()
        
        # Recent activity (last 30 days)
        recent_activity = conn.execute("""
            SELECT 
                event_type,
                COUNT(*) as count,
                DATE_TRUNC('day', created_at) as date
            FROM document_events 
            WHERE user_id = ? AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY event_type, DATE_TRUNC('day', created_at)
            ORDER BY date DESC
            LIMIT 30
        """, [user_id]).fetchall()
        
        # Blockchain statistics
        blockchain_stats = conn.execute("""
            SELECT 
                COUNT(*) as total_transactions,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_transactions,
                AVG(duration_seconds) as avg_transaction_time,
                SUM(gas_used) as total_gas_used
            FROM blockchain_events 
            WHERE user_id = ?
        """, [user_id]).fetchone()
        
        # Performance trends (last 7 days)
        performance_trend = conn.execute("""
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                AVG(duration_seconds) as avg_duration,
                COUNT(*) as event_count
            FROM document_events 
            WHERE user_id = ? AND created_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date
        """, [user_id]).fetchall()
        
        return {
            "user_id": user_id,
            "documents": {
                "total": doc_stats[0] or 0,
                "successful": doc_stats[1] or 0,
                "failed": doc_stats[2] or 0,
                "avg_generation_time": round(doc_stats[3] or 0, 2),
                "status_changes": doc_stats[4] or 0
            },
            "document_types": [
                {"type": row[0], "count": row[1]} for row in doc_types
            ],
            "recent_activity": [
                {"event_type": row[0], "count": row[1], "date": str(row[2])} 
                for row in recent_activity
            ],
            "blockchain": {
                "total_transactions": blockchain_stats[0] or 0,
                "successful_transactions": blockchain_stats[1] or 0,
                "avg_transaction_time": round(blockchain_stats[2] or 0, 2),
                "total_gas_used": blockchain_stats[3] or 0
            },
            "performance_trend": [
                {
                    "date": str(row[0]), 
                    "avg_duration": round(row[1] or 0, 2),
                    "event_count": row[2]
                } for row in performance_trend
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/system")
async def get_system_analytics():
    """Get system-wide analytics"""
    try:
        # Overall statistics
        system_stats = conn.execute("""
            SELECT 
                (SELECT COUNT(DISTINCT user_id) FROM document_events) as total_users,
                (SELECT COUNT(*) FROM document_events WHERE event_type = 'generation') as total_documents,
                (SELECT COUNT(*) FROM blockchain_events) as total_transactions,
                (SELECT AVG(duration_seconds) FROM document_events WHERE event_type = 'generation' AND status = 'success') as avg_doc_time,
                (SELECT AVG(duration_seconds) FROM blockchain_events WHERE status = 'success') as avg_blockchain_time
        """).fetchone()
        
        return {
            "total_users": system_stats[0] or 0,
            "total_documents": system_stats[1] or 0,
            "total_transactions": system_stats[2] or 0,
            "avg_document_generation_time": system_stats[3] or 0,
            "avg_blockchain_transaction_time": system_stats[4] or 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)