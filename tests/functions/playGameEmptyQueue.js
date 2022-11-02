const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function playGameEmptyQueue(program, provider, gameAccount, gameQueueAccount) {
	const playerAccount = anchor.web3.Keypair.generate();

	await program.rpc.joinEmptyGameQueue({
		accounts: {
			playerAccount: playerAccount.publicKey,
			gameAccount: gameAccount.publicKey,
			gameQueueAccount: gameQueueAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [playerAccount]
	});

	const player = await program.account.player.fetch(playerAccount.publicKey);
	return { playerAccount, player };
}

module.exports = {
	playGameEmptyQueue,
};