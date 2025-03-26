/*
  Warnings:

  - You are about to alter the column `winning_option_index` on the `markets` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `option_index` on the `walletActivity` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "markets" ALTER COLUMN "winning_option_index" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "walletActivity" ALTER COLUMN "option_index" SET DATA TYPE INTEGER;
