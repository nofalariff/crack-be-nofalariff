-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('SHIPMENT_STATUS_CHANGED', 'SHIPMENT_WEIGHT_CORRECTED', 'SHIPMENT_CREATED_BY_ADMIN', 'PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'AGENT_APPROVED', 'AGENT_REJECTED', 'USER_STATUS_CHANGED', 'ROUTE_CREATED', 'ROUTE_UPDATED', 'RATE_UPDATED');

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "minChargeableWeightSnapshot" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);
