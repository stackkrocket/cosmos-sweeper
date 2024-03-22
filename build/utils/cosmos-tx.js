import { DEFAULT_DENOMINATION, DEFAULT_TOKEN_PREFIX, EXPLORER_TX_PATH, GAS_MULTIPLIER } from "../config.js";
import { coins } from "@cosmjs/proto-signing";
import { getCurrentTime } from "./other.js";
import { getWalletBalance } from "./cosmos-common.js";
export async function delayTransaction(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export async function sendConsolidatedTransactions(walletItems) {
    const groupedBySender = groupBySender(walletItems);
    while (true) {
        for (const sender in groupedBySender) {
            const itemsFromSameSender = groupedBySender[sender];
            const currentBalance = await getWalletBalance(itemsFromSameSender[0].client, sender);
            if (currentBalance.int > 0) {
                const { messages, totalAmountToSend } = determineMessagesAndTotalAmount(itemsFromSameSender, currentBalance);
                await handleTransaction(sender, itemsFromSameSender, currentBalance, messages, totalAmountToSend);
            }
            else {
                console.log(`${getCurrentTime()} ${sender}: balance 0 $UATOM.`);
            }
        }
        //await delayTransaction(5000)
    }
}
function determineMessagesAndTotalAmount(itemsFromSameSender, currentBalance) {
    if (itemsFromSameSender.length === 1) {
        const totalAmountToSend = computeSingleAmountToSend(itemsFromSameSender, currentBalance);
        return {
            messages: createSingleMessage(itemsFromSameSender[0], totalAmountToSend),
            totalAmountToSend
        };
    }
    else {
        const totalAmountToSend = computeMultipleAmountToSend(itemsFromSameSender);
        return {
            messages: createMultipleMessages(itemsFromSameSender),
            totalAmountToSend
        };
    }
}
function computeSingleAmountToSend(itemsFromSameSender, currentBalance) {
    if (itemsFromSameSender[0].amount === -1) {
        return currentBalance;
    }
    return {
        int: itemsFromSameSender[0].amount * DEFAULT_DENOMINATION,
        float: itemsFromSameSender[0].amount
    };
}
function computeMultipleAmountToSend(itemsFromSameSender) {
    const intSum = Math.floor(itemsFromSameSender.reduce((sum, item) => sum + item.amount, 0) * DEFAULT_DENOMINATION);
    return {
        int: intSum,
        float: parseFloat((intSum / DEFAULT_DENOMINATION).toFixed(4))
    };
}
function groupBySender(walletItems) {
    const groupedBySender = {};
    for (const item of walletItems) {
        if (!groupedBySender[item.address]) {
            groupedBySender[item.address] = [];
        }
        groupedBySender[item.address].push(item);
    }
    return groupedBySender;
}
function logInsufficientBalance(sender, required, actual) {
    console.log(`${getCurrentTime()} ${sender}: the minimum balance should be: ${required} $${DEFAULT_TOKEN_PREFIX.toUpperCase()}, but it's only ${actual} $${DEFAULT_TOKEN_PREFIX.toUpperCase()}.`);
}
function createSingleMessage(itemsFromSameSender, totalAmountToSend) {
    return [{
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: {
                fromAddress: itemsFromSameSender.address,
                toAddress: itemsFromSameSender.recipient,
                amount: [{
                        amount: Math.floor(totalAmountToSend.int).toString(),
                        denom: DEFAULT_TOKEN_PREFIX
                    }]
            },
        }];
}
function createMultipleMessages(itemsFromSameSender) {
    return itemsFromSameSender.map(item => ({
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: {
            fromAddress: itemsFromSameSender[0].address,
            toAddress: item.recipient,
            amount: [{
                    amount: Math.floor(item.amount * DEFAULT_DENOMINATION).toString(),
                    denom: DEFAULT_TOKEN_PREFIX
                }]
        },
    }));
}
function calculateFee(estimatedFeeAdjustment) {
    return {
        amount: coins(estimatedFeeAdjustment, DEFAULT_TOKEN_PREFIX),
        gas: String(estimatedFeeAdjustment)
    };
}
function adjustForFullBalance(currentBalance, estimatedFeeAdjustment) {
    return {
        int: currentBalance.int - estimatedFeeAdjustment,
        float: parseFloat((Math.floor(currentBalance.int - estimatedFeeAdjustment) / DEFAULT_DENOMINATION).toFixed(4))
    };
}
async function trySendOrLogError(sender, itemsFromSameSender, currentBalance, messages, fee, totalAmountToSend, estimatedFeeAdjustment) {
    if (totalAmountToSend.int + estimatedFeeAdjustment <= currentBalance.int) {
        const txHash = await itemsFromSameSender[0].client.signAndBroadcastSync(sender, messages, fee, itemsFromSameSender[0].memo);
        console.log(`${getCurrentTime()} ${sender} -> ${totalAmountToSend.float} $UATOM | fee: ${parseFloat((estimatedFeeAdjustment / DEFAULT_DENOMINATION).toFixed(4))} $UATOM | ${EXPLORER_TX_PATH}/${txHash}.`);
    }
    else {
        logInsufficientBalance(sender, totalAmountToSend.int + estimatedFeeAdjustment, currentBalance.int);
    }
}
async function handleTransaction(sender, itemsFromSameSender, currentBalance, messages, totalAmountToSend) {
    if (totalAmountToSend.int <= currentBalance.int) {
        const estimatedFee = await itemsFromSameSender[0].client.simulate(sender, messages, itemsFromSameSender[0].memo);
        const estimatedFeeAdjustment = Math.floor(estimatedFee * GAS_MULTIPLIER);
        const fee = calculateFee(estimatedFeeAdjustment);
        if (totalAmountToSend.int === currentBalance.int) {
            totalAmountToSend = adjustForFullBalance(currentBalance, estimatedFeeAdjustment);
            messages = createSingleMessage(itemsFromSameSender[0], totalAmountToSend);
        }
        await trySendOrLogError(sender, itemsFromSameSender, currentBalance, messages, fee, totalAmountToSend, estimatedFeeAdjustment);
    }
    else {
        logInsufficientBalance(sender, totalAmountToSend.int, currentBalance.int);
    }
}
