import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import dotenv from 'dotenv';
dotenv.config();

export const RPC_ENDPOINT = process.env.RPC_ENDPOINT;

// Load wallet from Solana CLI default location
const walletPath = `${os.homedir()}/.config/solana/id.json`;
const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
export const PAYER_KEYPAIR = Keypair.fromSecretKey(Buffer.from(secretKey));

if (!RPC_ENDPOINT) throw new Error('Please set RPC_ENDPOINT in .env');
