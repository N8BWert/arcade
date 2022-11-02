const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function finishGameQueue(program, provider, currentPlayerAccount, gameAccount, gameQueueAccount) {
	await program.rpc.finishGameQueue({
		accounts: {
			currentPlayer: currentPlayerAccount.publicKey,
			gameQueueAccount: gameQueueAccount.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		}
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);
	return { updatedGame };
}

module.exports = {
	finishGameQueue,
};