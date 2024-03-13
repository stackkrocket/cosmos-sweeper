import { getWalletItems, printBalances, untilPositiveBalance } from "./utils/cosmos-common.js";
import { sendConsolidatedTransactions } from "./utils/cosmos-tx.js";
import { readFile, sleep, until5SecLeft } from "./utils/other.js";
import { GENESIS_TIMESTAMP, RPC_ENDPOINT } from "./config.js";
async function main() {
    let fileStrings = readFile("../.././data/mnemonic.txt");
    await until5SecLeft(GENESIS_TIMESTAMP);
    let walletItems = await getWalletItems(fileStrings, RPC_ENDPOINT);
    console.log('\n/////// BALANCE ///////\n');
    await untilPositiveBalance(walletItems);
    console.log('\n/////// TRANSFER ///////\n');
    await sendConsolidatedTransactions(walletItems);
    console.log();
    await sleep(30000);
    console.log('\n/////// BALANCE ///////\n');
    await printBalances(walletItems, true, true);
    await sleep(1000, false);
    console.log('\nwith loveeee....\n');
}
await main();
