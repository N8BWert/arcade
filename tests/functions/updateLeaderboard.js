const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function updateLeaderboard(program, provider, gameAccount) {
	const playerName = "ABC";
	const score = 2048;
	const walletKey = anchor.web3.Keypair.generate();

	await program.rpc.updateLeaderboard(playerName, score, walletKey.publicKey, {
		accounts: {
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		}
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);
	return { playerName, score, walletKey, updatedGame };
}

module.exports = {
	updateLeaderboard,
}