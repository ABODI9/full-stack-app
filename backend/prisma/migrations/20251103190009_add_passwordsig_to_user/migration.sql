/*
  Warnings:

  - Added the required column `passwordSig` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordSig" VARCHAR(64) NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'manager';

-- CreateIndex
CREATE INDEX "User_passwordSig_idx" ON "User"("passwordSig");
