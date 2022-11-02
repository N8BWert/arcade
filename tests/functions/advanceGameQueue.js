const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function advanceGameQueue(program, provider, currentPlayerAccount, nextPlayerAccount, gameQueueAccount, gameAccount) {
	await program.rpc.advanceGameQueue({
		accounts: {
			currentPlayer: currentPlayerAccount.publicKey,
			nextPlayer: nextPlayerAccount.publicKey,
			gameQueueAccount: gameQueueAccount.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		}
	});

	const updatedGameQueue = await program.account.gameQueue.fetch(gameQueueAccount.publicKey);
	return { updatedGameQueue };
}

module.exports = {
	advanceGameQueue,
};