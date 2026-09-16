-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('PORT_TO_PORT', 'PORT_TO_DOOR');

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "destinationCode" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "destinationRegion" TEXT NOT NULL,
    "estimatedDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rates" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "pricePerKg" BIGINT NOT NULL,
    "minChargeableWeight" INTEGER NOT NULL,
    "baseFee" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "routes_serviceType_destinationCode_key" ON "routes"("serviceType", "destinationCode");

-- CreateIndex
CREATE INDEX "rates_routeId_isActive_idx" ON "rates"("routeId", "isActive");

-- AddForeignKey
ALTER TABLE "rates" ADD CONSTRAINT "rates_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
