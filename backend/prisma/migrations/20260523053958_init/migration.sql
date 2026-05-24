-- CreateTable
CREATE TABLE "llm_inference_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "history_count" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "started_at" DATETIME NOT NULL,
    "ended_at" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "candidates_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "prompt_content" TEXT NOT NULL,
    "response_content" TEXT,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "llm_inference_logs_session_id_idx" ON "llm_inference_logs"("session_id");

-- CreateIndex
CREATE INDEX "llm_inference_logs_status_idx" ON "llm_inference_logs"("status");

-- CreateIndex
CREATE INDEX "llm_inference_logs_created_at_idx" ON "llm_inference_logs"("created_at");
