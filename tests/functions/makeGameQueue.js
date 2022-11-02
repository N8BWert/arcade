const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function makeGameQueue(program, provider, gameAccount) {
	const queueAccount = anchor.web3.Keypair.generate();

	await program.rpc.initializeGameQueue({
		accounts: {
			gameQueueAccount: queueAccount.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
		signers: [queueAccount],
	});

	const gameQueue = await program.account.gameQueue.fetch(queueAccount.publicKey);
	return { queueAccount, gameQueue };
}

module.exports = {
	makeGameQueue,
};