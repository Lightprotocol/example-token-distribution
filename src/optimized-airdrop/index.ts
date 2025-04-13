import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
    calculateComputeUnitPrice,
    createRpc,
    Rpc,
} from '@lightprotocol/stateless.js';
import { createMint, getTokenPoolInfos } from '@lightprotocol/compressed-token';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { createAirdropInstructions } from './create-instructions';
import { BatchResultType, signAndSendAirdropBatches } from './sign-and-send';
import { PAYER_KEYPAIR, RPC_ENDPOINT } from '../constants';

const connection: Rpc = createRpc(RPC_ENDPOINT);
const payer = PAYER_KEYPAIR;

// These are 20 example Solana Pubkeys
const recipients = [
    'GMPWaPPrCeZPse5kwSR3WUrqYAPrVZBSVwymqh7auNW7',
    'GySGrTgPtPfMtYoYTmwUdUDFwVJbFMfip7QZdhgXp8dy',
    'Bk1r2vcgX2uTzwV3AUyfRbSfGKktoQrQufBSrHzere74',
    '8BvkadZ6ycFNmQF7S1MHRvEVNb1wvDBFdjkAUnxjK9Ug',
    'EmxcvFKXsWLzUho8AhV9LCKeKRFHg5gAs4sKNJwhe5PF',
    '6mqdHkSpcvNexmECjp5XLt9V9KnSQre9TvbMLGr6sEPM',
    '3k4MViTWXBjFvoUZiJcNGPvzrqnTa41gcrbWCMMnV6ys',
    '2k6BfYRUZQHquPtpkyJpUx3DzM7W3K6H95igtJk8ztpd',
    '89jPyNNLCcqWn1RZThSS4jSqU5VCJkR5mAaSaVzuuqH4',
    '3MzSRLf9jSt6d1MFFMMtPfUcDY6XziRxTB8C5mfvgxXG',
    '9A1H6f3N8mpAPSdfqvYRD4cM1NwDZoMe3yF5DwibL2R2',
    'PtUAhLvUsVcoesDacw198SsnMoFNVskR5pT3QvsBSQw',
    '6C6W6WpgFK8TzTTMNCPMz2t9RaMs4XnkfB6jotrWWzYJ',
    '8sLy9Jy8WSh6boq9xgDeBaTznn1wb1uFpyXphG3oNjL5',
    'GTsQu2XCgkUczigdBFTWKrdDgNKLs885jKguyhkqdPgV',
    '85UK4bjC71Jwpyn8mPSaW3oYyEAiHPbESByq9s5wLcke',
    '9aEJT4CYHEUWwwSQwueZc9EUjhWSLD6AAbpVmmKDeP7H',
    'CY8QjRio1zd9bYWMKiVRrDbwVenf3JzsGf5km5zLgY9n',
    'CeHbdxgYifYhpB6sXGonKzmaejqEfq2ym5utTmB6XMVv',
    '4z1qss12DjUzGUkK1fFesqrUwrEVJJvzPMNkwqYnbAR5',
].map(address => new PublicKey(address));

(async () => {
    // provide from previous steps
    // const mint = new PublicKey("FLEaDiqyipcu3fHiiohMJiGzzmJRmbEAJzfUfqjCFTu9");

    /// Create an SPL mint + register it for compression.
    const { mint, transactionSignature } = await createMint(
        connection,
        PAYER_KEYPAIR,
        PAYER_KEYPAIR.publicKey,
        9,
    );
    console.log(
        `create-mint success! txId: ${transactionSignature}, mint: ${mint.toBase58()}`,
    );

    /// Create an associated SPL token account for the sender (PAYER)
    const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey,
    );
    console.log(`ATA: ${ata.address.toBase58()}`);

    //   /// Mint SPL tokens to the sender
    const mintToTxId = await mintTo(
        connection,
        payer,
        mint,
        ata.address,
        payer.publicKey,
        10e9 * LAMPORTS_PER_SOL, // 10B tokens * decimals
    );
    console.log(`mint-to success! txId: ${mintToTxId}`);

    const treeInfos = await connection.getCachedActiveStateTreeInfos();
    const tokenPoolInfos = await getTokenPoolInfos(connection, mint);

    const instructionBatches = await createAirdropInstructions({
        amount: 1e6,
        recipients,
        payer: payer.publicKey,
        sourceTokenAccount: ata.address,
        mint,
        treeInfos,
        tokenPoolInfos,
        computeUnitPrice: calculateComputeUnitPrice(10_000, 500_000),
    });

    for await (const result of signAndSendAirdropBatches(
        instructionBatches,
        payer,
        connection,
    )) {
        if (result.type === BatchResultType.Success) {
            console.log(`Batch ${result.index} confirmed: ${result.signature}`);
        } else if (result.type === BatchResultType.Error) {
            console.log(`Batch ${result.index} failed: ${result.error}`);
            // Use result.index to access the specific batch in instructionBatches
            const failedBatch = instructionBatches[result.index];
            console.log(`Failed batch instructions:`, failedBatch);
            // Additional logic to handle failed instructions
        }
    }

    console.log('Airdrop process complete.');
})();
