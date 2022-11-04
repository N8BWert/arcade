const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function makeGameQueue(program, provider, gameAccount) {
	const queueAccount = anchor.web3.Keypair.generate();
	const playerAccount = anchor.web3.Keypair.generate();

	await program.rpc.initializeGameQueue({
		accounts: {
			gameQueueAccount: queueAccount.publicKey,
			playerAccount: playerAccount.publicKey,
			gameAccount: gameAccount.publicKey,
			payer: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [queueAccount, playerAccount],
	});

	const gameQueue = await program.account.gameQueue.fetch(queueAccount.publicKey);
	const player = await program.account.player.fetch(playerAccount.publicKey);
	return { queueAccount, gameQueue, playerAccount, player };
}

module.exports = {
	makeGameQueue,
};