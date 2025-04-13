import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';
dotenv.config();

export const RPC_ENDPOINT = process.env.RPC_ENDPOINT;
export const PAYER_KEYPAIR = Keypair.fromSecretKey(
    bs58.decode(process.env.PAYER_KEYPAIR!),
);
export const MINT_ADDRESS = new PublicKey(process.env.MINT_ADDRESS!);

if (!RPC_ENDPOINT) throw new Error('Please set RPC_ENDPOINT in .env');
