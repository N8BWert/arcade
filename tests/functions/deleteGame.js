const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function deleteGame(program, provider, gameAccount, earlierGameAccount, laterGameAccount) {
	await program.rpc.deleteGame({
		accounts: {
			gameAccount: gameAccount.publicKey,
			youngerGame: earlierGameAccount.publicKey,
			olderGame: laterGameAccount.publicKey,
			owner: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		}
	});

	const updatedEarlierGame = await program.account.game.fetch(earlierGameAccount.publicKey);
	const updatedLaterGame = await program.account.game.fetch(laterGameAccount.publicKey);

	return { updatedEarlierGame, updatedLaterGame };
}

module.exports = {
	deleteGame,
};