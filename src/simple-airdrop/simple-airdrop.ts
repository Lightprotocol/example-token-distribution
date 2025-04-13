import {
    PublicKey,
    TransactionInstruction,
    ComputeBudgetProgram,
} from '@solana/web3.js';
import {
    CompressedTokenProgram,
    getTokenPoolInfos,
    selectTokenPoolInfo,
} from '@lightprotocol/compressed-token';
import {
    bn,
    buildAndSignTx,
    calculateComputeUnitPrice,
    createRpc,
    dedupeSigner,
    Rpc,
    selectStateTreeInfo,
    sendAndConfirmTx,
} from '@lightprotocol/stateless.js';
import { getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import { MINT_ADDRESS, PAYER_KEYPAIR, RPC_ENDPOINT } from '../constants';

(async () => {
    const connection: Rpc = createRpc(RPC_ENDPOINT);
    const mintAddress = MINT_ADDRESS;
    const payer = PAYER_KEYPAIR;
    const owner = payer;
    const recipients = [
        PublicKey.default,
        // ...
    ];

    // 1. Select a state tree
    const treeInfos = await connection.getCachedActiveStateTreeInfos();
    const treeInfo = selectStateTreeInfo(treeInfos);

    // 2. Select a token pool
    const tokenPoolInfos = await getTokenPoolInfos(connection, mintAddress);
    const tokenPoolInfo = selectTokenPoolInfo(tokenPoolInfos);

    // Create an SPL token account for the sender.
    // The sender will send tokens from this account to the recipients as compressed tokens.
    const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintAddress,
        payer.publicKey,
    );

    // 1 recipient = 120_000 CU
    // 5 recipients = 170_000 CU
    const units = 120_000;
    const amount = bn(333);
    // To land faster, replace this with a dynamic fee based on network
    // conditions.
    const microLamports = calculateComputeUnitPrice(20_000, units);

    const instructions: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitLimit({ units }),
        ComputeBudgetProgram.setComputeUnitPrice({
            microLamports,
        }),
    ];

    const compressInstruction = await CompressedTokenProgram.compress({
        payer: payer.publicKey,
        owner: owner.publicKey,
        source: sourceTokenAccount.address,
        toAddress: recipients,
        amount: recipients.map(() => amount),
        mint: mintAddress,
        outputStateTreeInfo: treeInfo,
        tokenPoolInfo,
    });
    instructions.push(compressInstruction);

    // https://www.zkcompression.com/developers/protocol-addresses-and-urls#lookup-tables
    const lookupTableAddress = new PublicKey(
        '9NYFyEqPkyXUhkerbGHXUXkvb4qpzeEdHuGpgbgpH1NJ', // mainnet
        // "qAJZMgnQJ8G6vA3WRcjD9Jan1wtKkaCFWLWskxJrR5V" // devnet
    );

    // Get the lookup table account state
    const lookupTableAccount = (
        await connection.getAddressLookupTable(lookupTableAddress)
    ).value!;

    const additionalSigners = dedupeSigner(payer, [owner]);

    const { blockhash } = await connection.getLatestBlockhash();

    const tx = buildAndSignTx(
        instructions,
        payer,
        blockhash,
        additionalSigners,
        [lookupTableAccount],
    );

    const txId = await sendAndConfirmTx(connection, tx);
    console.log(`txId: ${txId}`);
})();
