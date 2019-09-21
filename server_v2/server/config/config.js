import dotenv from 'dotenv';

const envs = { ...dotenv.config(), ...process.env };

export default envs;
