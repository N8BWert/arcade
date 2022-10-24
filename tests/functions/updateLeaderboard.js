const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function updateLeaderboard(program, provider, gameAccount, playerName, score, walletKey) {
	await program.rpc.updateLeaderboard(playerName, score, walletKey.publicKey, {
		accounts: {
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		}
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);
	return { updatedGame };
}

module.exports = {
	updateLeaderboard,
}