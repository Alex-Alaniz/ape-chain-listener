import { ethers } from "ethers";
import BigNumber from "bignumber.js";
import { pool } from "./config/dbConfig.js";

const provider = new ethers.providers.WebSocketProvider(process.env.RPC_URL);
const contractAddress = process.env.CONTRACT_ADDRESS;

const abi = [
  "event SharesPurchased(uint256 indexed marketId, address indexed buyer, uint256 optionIndex, uint256 amount)",
  "event MarketResolved(uint256 indexed marketId, uint256 winningOptionIndex)",
  "event Claimed(uint256 indexed marketId, address indexed user, uint256 amount)",
];

const contract = new ethers.Contract(contractAddress, abi, provider);
// const blockNumber = await provider.getBlockNumber();
// console.log("block number :", blockNumber);

async function saveEventToDB(
  wallet_address,
  market_id,
  option_index,
  amount,
  event_type
) {
  const query = `
  INSERT INTO "walletActivity" 
  (wallet_address, market_id, ${
    event_type === "buy"
      ? "option_index, shares, amount_spent"
      : "amount_claimed"
  }, event_type)
  VALUES ($1, $2, ${event_type === "buy" ? "$3, $4, $5" : "$3"}, ${
    event_type === "buy" ? "$6" : "$4"
  })
  RETURNING *;
`;

  try {
    const values =
      event_type === "buy"
        ? [wallet_address, market_id, option_index, amount, amount, event_type]
        : [wallet_address, market_id, amount, event_type];
    console.log(event_type, " ", values);
    const result = await pool.query(query, values);
    console.log(`${event_type} Event Saved:`, result.rows[0]);
  } catch (error) {
    console.error("Error inserting transaction:", error);
  }
}

async function updateLeaderboard(wallet_address, amount, event_type) {
  try {
    const numericAmount = parseFloat(amount);

    // Check primary wallet
    const primaryQuery = `SELECT primary_wallet FROM "userWallets" WHERE wallet_address = $1;`;
    const primaryResult = await pool.query(primaryQuery, [wallet_address]);

    if (primaryResult.rowCount === 0) {
      console.log(`Primary wallet not found for ${wallet_address}`);
      return;
    }

    const primary_wallet = primaryResult.rows[0].primary_wallet;

    // Check if leaderboard entry exists
    const checkQuery = `SELECT * FROM "usersLeaderboard" WHERE primary_wallet = $1;`;
    const checkResult = await pool.query(checkQuery, [primary_wallet]);

    if (checkResult.rowCount > 0) {
      const updateQuery =
        event_type === "buy"
          ? `UPDATE "usersLeaderboard" 
             SET total_invested = total_invested + $2::numeric, 
                 pnl = CAST(total_claimed AS numeric) - CAST((total_invested + $2::numeric) AS numeric) 
             WHERE primary_wallet = $1;`
          : `UPDATE "usersLeaderboard" 
             SET total_claimed = total_claimed + $2::numeric, 
                 pnl = CAST((total_claimed + $2::numeric) AS numeric) - CAST(total_invested AS numeric) 
             WHERE primary_wallet = $1;`;

      await pool.query(updateQuery, [primary_wallet, numericAmount]);
    } else {
      const insertQuery =
        event_type === "buy"
          ? `INSERT INTO "usersLeaderboard" (primary_wallet, total_invested, total_claimed, pnl) 
             VALUES ($1, $2::numeric, 0, -($2::numeric));`
          : `INSERT INTO "usersLeaderboard" (primary_wallet, total_invested, total_claimed, pnl) 
             VALUES ($1, 0, $2::numeric, $2::numeric);`;

      await pool.query(insertQuery, [primary_wallet, numericAmount]);
    }

    console.log(`Leaderboard updated for ${primary_wallet}`);
  } catch (error) {
    console.error("Error updating leaderboard:", error);
  }
}
// fetch previous events
async function fetchEventsForEvent(startBlock, endBlock, batchSize = 2000) {
  console.log(`Fetching events from block ${startBlock} to ${endBlock}`);

  for (let i = startBlock; i <= endBlock; i += batchSize) {
    let fromBlock = i;
    let toBlock = Math.min(i + batchSize - 1, endBlock);

    console.log(`Fetching events from block ${fromBlock} to ${toBlock}`);

    try {
      const sharesPurchasedEvents = await contract.queryFilter(
        contract.filters.SharesPurchased(),
        fromBlock,
        toBlock
      );

      const claimedEvents = await contract.queryFilter(
        contract.filters.Claimed(),
        fromBlock,
        toBlock
      );

      if (sharesPurchasedEvents.length > 0) {
        for (const event of sharesPurchasedEvents) {
          console.log(event.args);
          const { marketId, buyer, optionIndex, amount } = event.args;
          const valueInWei = BigInt(amount);
          const valueInEth = new BigNumber(valueInWei.toString())
            .dividedBy("1e18")
            .toString();
          console.log(valueInEth);
          await saveEventToDB(
            buyer,
            marketId.toString(),
            optionIndex.toString(),
            valueInEth,
            "buy"
          );
          await updateLeaderboard(buyer, valueInEth, "buy");
        }
      } else {
        console.log(`No SharesPurchased events found in this batch`);
      }

      if (claimedEvents.length > 0) {
        for (const event of claimedEvents) {
          const { marketId, user, amount } = event.args;
          console.log("claim ", event.args);
          const valueInWei = BigInt(amount);
          const valueInEth = new BigNumber(valueInWei.toString())
            .dividedBy("1e18")
            .toString();

          console.log(valueInEth);
          await saveEventToDB(
            user,
            marketId.toString(),
            null,
            valueInEth,
            "claim"
          );
          await updateLeaderboard(user, valueInEth, "claim");
        }
      } else {
        console.log(`No Claimed events found in this batch`);
      }
    } catch (error) {
      console.error(
        `Error fetching events from ${fromBlock} to ${toBlock}:`,
        error
      );
    }
  }
}

// runtime event listener----------------------------------
async function saveLogInDb(
  wallet_address,
  market_id,
  option_index,
  amount,
  event_type
) {
  const query = `
  INSERT INTO "walletActivity" 
  (wallet_address, market_id, ${
    event_type === "buy"
      ? "option_index, shares, amount_spent"
      : "amount_claimed"
  }, event_type)
  VALUES ($1, $2, ${event_type === "buy" ? "$3, $4, $5" : "$3"}, ${
    event_type === "buy" ? "$6" : "$4"
  })
  RETURNING *;
`;
  try {
    const values =
      event_type === "buy"
        ? [wallet_address, market_id, option_index, amount, amount, event_type]
        : [wallet_address, market_id, amount, event_type];
    const result = await pool.query(query, values);
    console.log(`${event_type} Event Saved:`, result.rows[0]);
  } catch (error) {
    console.error("Error inserting transaction:", error);
  }
}

async function startLiveEventListeners() {
  console.log("Listening for live blockchain events...");
  contract.on(
    "SharesPurchased",
    async (marketId, buyer, optionIndex, amount) => {
      console.log(`SharesPurchased Event:`, {
        marketId,
        buyer,
        optionIndex,
        amount,
      });
      const valueInWei = BigInt(amount);
      const valueInEth = new BigNumber(valueInWei.toString())
        .dividedBy("1e18")
        .toString();
      console.log(valueInEth);
      await saveLogInDb(
        buyer,
        marketId.toString(),
        optionIndex.toString(),
        valueInEth,
        "buy"
      );
      await updateLeaderboard(buyer, valueInEth, "buy");
    }
  );

  contract.on("Claimed", async (marketId, user, amount) => {
    console.log(`Claimed Event:`, { marketId, user, amount });
    const valueInWei = BigInt(amount);
    const valueInEth = new BigNumber(valueInWei.toString())
      .dividedBy("1e18")
      .toString();

    console.log(valueInEth);
    await saveLogInDb(user, marketId.toString(), null, valueInEth, "claim");
    await updateLeaderboard(user, valueInEth, "claim");
  });

  console.log("Real-time event listeners started!");
}

export { startLiveEventListeners, fetchEventsForEvent };
