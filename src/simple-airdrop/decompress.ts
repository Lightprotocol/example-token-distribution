import { PublicKey, ComputeBudgetProgram } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import {
    CompressedTokenProgram,
    getTokenPoolInfos,
    selectMinCompressedTokenAccountsForTransfer,
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
import { MINT_ADDRESS, PAYER_KEYPAIR, RPC_ENDPOINT } from '../constants';

(async () => {
    const connection: Rpc = createRpc(RPC_ENDPOINT);
    const mint = MINT_ADDRESS;
    const payer = PAYER_KEYPAIR;
    const owner = payer;
    const amount = bn(100);
    const recipient = PublicKey.default;

    const treeInfos = await connection.getCachedActiveStateTreeInfos();
    const treeInfo = selectStateTreeInfo(treeInfos);

    const tokenPoolInfos = await getTokenPoolInfos(connection, mint);
    const selectedTokenPoolInfos = selectTokenPoolInfosForDecompression(
        tokenPoolInfos,
        amount,
    );

    // Create an SPL token account for the sender.
    // The sender will send tokens from this account to the recipients as compressed tokens.
    const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey,
    );

    const compressedTokenAccounts =
        await connection.getCompressedTokenAccountsByOwner(owner.publicKey, {
            mint,
        });

    const [inputAccounts] = selectMinCompressedTokenAccountsForTransfer(
        compressedTokenAccounts.items,
        amount,
    );

    const proof = await connection.getValidityProofV0(
        inputAccounts.map(account => ({
            hash: bn(account.compressedAccount.hash),
            tree: account.compressedAccount.merkleTree,
            queue: account.compressedAccount.nullifierQueue,
        })),
    );

    const ix = await CompressedTokenProgram.decompress({
        payer: payer.publicKey,
        inputCompressedTokenAccounts: inputAccounts,
        toAddress: recipient,
        amount,
        outputStateTreeInfo: treeInfo,
        tokenPoolInfos: selectedTokenPoolInfos,
        recentInputStateRootIndices: proof.rootIndices,
        recentValidityProof: proof.compressedProof,
    });

    const { blockhash } = await connection.getLatestBlockhash();
    const additionalSigners = dedupeSigner(payer, [owner]);
    const signedTx = buildAndSignTx(
        [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), ix],
        payer,
        blockhash,
        additionalSigners,
    );
    return await sendAndConfirmTx(connection, signedTx);
})();
