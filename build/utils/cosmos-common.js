import { DEFAULT_DENOMINATION, DEFAULT_ADDRESS_PREFIX, DEFAULT_TOKEN_PREFIX } from "../config.js";
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { identifyInput, sleep, getCurrentTime } from "./other.js";
export async function getWalletFromString(string) {
    if (identifyInput(string) === 'private_key') {
        return await DirectSecp256k1Wallet.fromKey(new Uint8Array(string.match(/.{1,2}/g).map(byte => parseInt(byte, 16))), DEFAULT_ADDRESS_PREFIX);
    }
    else {
        return await DirectSecp256k1HdWallet.fromMnemonic(string, { prefix: DEFAULT_ADDRESS_PREFIX });
    }
}
export async function getWalletItems(strings, rpcEndpoint) {
    const itemsPromises = strings.map(async (mnemonic_string) => {
        var _a;
        let mnemonic = mnemonic_string.split('##')[0];
        let recipient = mnemonic_string.split('##')[1];
        let amount = mnemonic_string.split('##')[2];
        let memo = (_a = mnemonic_string.split('##')[3]) !== null && _a !== void 0 ? _a : '';
        let wallet = await getWalletFromString(mnemonic);
        let client;
        while (true) {
            try {
                client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet);
                if (client) {
                    break;
                }
            }
            catch (error) {
                console.error(`waiting for the ${rpcEndpoint} to be online...`);
            }
        }
        // const client: SigningStargateClient = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet)
        const [account] = await wallet.getAccounts();
        return {
            client: client,
            wallet: wallet,
            address: account.address,
            recipient: recipient,
            amount: parseFloat(amount),
            memo: memo
        };
    });
    return Promise.all(itemsPromises);
}
export async function getWalletBalance(client, address) {
    let balance = await client.getBalance(address, DEFAULT_TOKEN_PREFIX);
    return {
        int: parseInt(balance.amount),
        float: parseFloat((parseInt(balance.amount) / DEFAULT_DENOMINATION).toFixed(4))
    };
}
export async function printBalances(walletItems, to_send = true, recipient = false) {
    for (const item of walletItems) {
        const donor_balance = await getWalletBalance(item.client, item.address);
        const recipient_balance = await getWalletBalance(item.client, item.recipient);
        if (to_send) {
            const amount_to_send = item.amount === -1 ? donor_balance.float : item.amount;
            console.log(`${getCurrentTime()} ${item.address}: ${donor_balance.float} $ATOM | ${amount_to_send} $ATOM to ${item.recipient}.`);
        }
        else {
            console.log(`${getCurrentTime()} ${item.address}: ${donor_balance.float} $ATOM.`);
        }
        if (recipient) {
            console.log(`${getCurrentTime()} ${item.recipient}: ${recipient_balance.float} $ATOM.\n`);
        }
    }
}
export async function untilSinglePositiveBalance(item) {
    let donor_balance;
    do {
        donor_balance = await getWalletBalance(item.client, item.address);
        if (donor_balance.int <= 0) {
            console.log(`${getCurrentTime()} ${item.address}: ${donor_balance.float} $ATOM, waiting for any balance.`);
            await sleep(1500, false);
        }
    } while (donor_balance.int <= 0);
    const amount_to_send = item.amount === -1 ? donor_balance.float : item.amount;
    console.log(`${getCurrentTime()} ${item.address}: ${donor_balance.float} $ATOM | ${amount_to_send} $ATOM to ${item.recipient}.`);
}
export async function untilPositiveBalance(walletItems) {
    for (const item of walletItems) {
        await untilSinglePositiveBalance(item);
    }
}
