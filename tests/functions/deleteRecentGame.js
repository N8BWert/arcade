const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function deleteRecentGame(program, provider, gameAccount, arcadeAccount, laterGameAccount) {

	await program.rpc.deleteMostRecentGame({
		accounts: {
			gameAccount: gameAccount.publicKey,
			arcadeState: arcadeAccount.publicKey,
			olderGame: laterGameAccount.publicKey,
			owner: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		}
	});

	const updatedArcade = await program.account.arcadeState.fetch(arcadeAccount.publicKey);
	const updatedLaterGame = await program.account.game.fetch(laterGameAccount.publicKey);

	return { updatedArcade, updatedLaterGame };
}

module.exports = {
	deleteRecentGame,
};