import { IndexedTx, SigningStargateClient, StargateClient, Coin } from "@cosmjs/stargate"
import { readFile } from "fs/promises"
import { DirectSecp256k1Wallet, OfflineDirectSigner } from "@cosmjs/proto-signing"
import { fromHex } from "@cosmjs/encoding"

const rpc = "https://cosmos-rpc.publicnode.com:443/9a353f27b9e92ea909491d7ae2102facbd105fb06ff969932dd19cb31d93d0a6"

const getUserSignerFromPriKey = async (): Promise<OfflineDirectSigner> => {
    return DirectSecp256k1Wallet.fromKey(
        fromHex((await readFile("./privatekey.txt")).toString()),
        "cosmos",
    )
}


const delay = async (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const runAll = async(): Promise<void> => {
    console.log("Starting Cosmos Sweeper")

   while(true) {
    
    try {
        //query and connect to rpc
        const client = await StargateClient.connect(rpc)
        console.log("With client, chain id:", await client.getChainId(), ", height:", await client.getHeight())

        //Recipient Address
        const recipientAddress = "cosmos1gu53gyf693zfqrxyhlw9ne7gqpdlvh50v76zgl"

            
        const userSigner: OfflineDirectSigner = await getUserSignerFromPriKey()
        const user = (await userSigner.getAccounts())[0].address
        console.log("User's address from signer", user)
        const signingClient = await SigningStargateClient.connectWithSigner(rpc, userSigner)
        console.log(
            "With signing client, chain id:",
            await signingClient.getChainId(),
            ", height:",
            await signingClient.getHeight()
            )

        console.log("User Balances are at query", await client.getAllBalances(user))

        const queryAmount: readonly Coin[] = await client.getAllBalances(user)
        const maxAmount = queryAmount[0].amount
        const maxAmountInNumber = parseFloat(maxAmount)
        const minimumToSend = maxAmountInNumber - 10000
        const minimumToSendInString = minimumToSend.toString()

        // Check the balance of Alice and the Faucet
        console.log("User balance before:", await client.getAllBalances(user))
        console.log("Recipient Address balance before:", await client.getAllBalances(recipientAddress))
        // Execute the sendTokens Tx and store the result
        const result = await signingClient.signAndBroadcast(
            // the signerAddress
            user,
            // the message(s)
            [
                {
                    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
                    value: {
                        fromAddress: user,
                        toAddress: recipientAddress,
                        amount: [
                            { denom: "uatom", amount: minimumToSendInString },
                        ],
                    },
                },
            ],
            // the fee
            {
                amount: [{ denom: "uatom", amount: "1000" }],
                gas: "200000",
            },
        )
            // Output the result of the Tx
            console.log("Transfer result:", result)
            console.log("User balance After:", await client.getAllBalances(user))
            console.log("Recipient Address balance After:", await client.getAllBalances(recipientAddress))

            await delay(5000)
    } catch (error) {
        console.error("Could Not complete transaction: ", error)

        await delay(5000)

        continue
    }
   }

}

runAll()