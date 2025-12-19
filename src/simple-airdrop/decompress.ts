import { PublicKey, ComputeBudgetProgram } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import {
    CompressedTokenProgram,
    createTokenPool,
    getTokenPoolInfos,
    selectMinCompressedTokenAccountsForTransfer,
    selectTokenPoolInfo,
    selectTokenPoolInfosForDecompression,
} from '@lightprotocol/compressed-token';
import {
    bn,
    buildAndSignTx,
    createRpc,
    dedupeSigner,
    Rpc,
    selectStateTreeInfo,
    sendAndConfirmTx,
} from '@lightprotocol/stateless.js';
import { PAYER_KEYPAIR, RPC_ENDPOINT } from '../constants';

(async () => {
    const connection: Rpc = createRpc(RPC_ENDPOINT);
    const payer = PAYER_KEYPAIR;
    const owner = payer;
    const amount = bn(100);

    // 1. Setup: Create mint + token pool + mint SPL tokens
    const mint = await createMint(connection, payer, payer.publicKey, null, 9);
    console.log(`Mint: ${mint.toBase58()}`);

    await createTokenPool(connection, payer, mint);
    console.log('Token pool created');

    const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey,
    );

    await mintTo(connection, payer, mint, sourceTokenAccount.address, payer.publicKey, 100_000_000_000);
    console.log('Minted 100 SPL tokens to ATA');

    // 2. Compress tokens to self
    const treeInfos = await connection.getStateTreeInfos();
    const treeInfo = selectStateTreeInfo(treeInfos);
    const tokenPoolInfos = await getTokenPoolInfos(connection, mint);
    const tokenPoolInfo = selectTokenPoolInfo(tokenPoolInfos);

    const compressIx = await CompressedTokenProgram.compress({
        payer: payer.publicKey,
        owner: owner.publicKey,
        source: sourceTokenAccount.address,
        toAddress: payer.publicKey,
        amount,
        mint,
        outputStateTreeInfo: treeInfo,
        tokenPoolInfo,
    });

    const { blockhash: compressBlockhash } = await connection.getLatestBlockhash();
    const compressTx = buildAndSignTx(
        [ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), compressIx],
        payer,
        compressBlockhash,
        dedupeSigner(payer, [owner]),
    );
    const compressTxId = await sendAndConfirmTx(connection, compressTx);
    console.log(`Compressed tokens: ${compressTxId}`);

    // 3. Decompress back to SPL
    // Refetch tokenPoolInfos since balance changed after compression
    const updatedTokenPoolInfos = await getTokenPoolInfos(connection, mint);
    const selectedTokenPoolInfos = selectTokenPoolInfosForDecompression(
        updatedTokenPoolInfos,
        amount,
    );

    const compressedTokenAccounts =
        await connection.getCompressedTokenAccountsByOwner(owner.publicKey, {
            mint,
        });

    const [inputAccounts] = selectMinCompressedTokenAccountsForTransfer(
        compressedTokenAccounts.items,
        amount,
    );

    const proof = await connection.getValidityProof(
        inputAccounts.map(account => bn(account.compressedAccount.hash)),
    );

    const decompressIx = await CompressedTokenProgram.decompress({
        payer: payer.publicKey,
        inputCompressedTokenAccounts: inputAccounts,
        toAddress: sourceTokenAccount.address,
        amount,
        tokenPoolInfos: selectedTokenPoolInfos,
        recentInputStateRootIndices: proof.rootIndices,
        recentValidityProof: proof.compressedProof,
    });

    const { blockhash } = await connection.getLatestBlockhash();
    const additionalSigners = dedupeSigner(payer, [owner]);
    const signedTx = buildAndSignTx(
        [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), decompressIx],
        payer,
        blockhash,
        additionalSigners,
    );
    const decompressTxId = await sendAndConfirmTx(connection, signedTx);
    console.log(`Decompressed tokens: ${decompressTxId}`);
})();
