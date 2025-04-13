import { Rpc, createRpc } from '@lightprotocol/stateless.js';
import { createMint } from '@lightprotocol/compressed-token';
import {
    getOrCreateAssociatedTokenAccount,
    mintTo as mintToSpl,
} from '@solana/spl-token';
import { PAYER_KEYPAIR, RPC_ENDPOINT } from '../constants';

const payer = PAYER_KEYPAIR;
const connection: Rpc = createRpc(RPC_ENDPOINT, RPC_ENDPOINT);
const decimals = 9;
const mintAmount = 100;

(async () => {
    // airdrop lamports to pay tx fees
    // await confirmTx(
    //   connection,
    //   await connection.requestAirdrop(payer.publicKey, 1e7)
    // );

    const { mint, transactionSignature } = await createMint(
        connection,
        payer,
        payer.publicKey,
        decimals,
    );
    console.log(
        `create-mint success! txId: ${transactionSignature}, mint: ${mint.toBase58()}`,
    );

    const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey,
    );
    console.log(`ata: ${ata.address}`);

    const mintTxId = await mintToSpl(
        connection,
        payer,
        mint,
        ata.address,
        payer.publicKey,
        mintAmount,
    );
    console.log(`mint-spl success! txId: ${mintTxId}`);
})();
