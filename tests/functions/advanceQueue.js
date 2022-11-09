const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function advanceOnePlayerQueue(program, provider, gameAccount, gameQueueAccount, currentPlayerAccount, nextPlayerAccount) {
	await program.rpc.advanceOnePlayerGameQueue({
		accounts: {
			currentPlayer: currentPlayerAccount.publicKey,
			nextPlayer: nextPlayerAccount.publicKey,
			gameQueueAccount: gameQueueAccount.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGameQueue = await program.account.gameQueue.fetch(gameQueueAccount.publicKey);

	return { updatedGameQueue };
}

async function advanceTwoPlayerQueue(program, provider, currentPlayerOneAccount, currentPlayerTwoAccount, nextPlayerOneAccount, nextPlayerTwoAccount, gameQueueAccountOne, gameQueueAccountTwo, gameAccount) {
	await program.rpc.advanceTwoPlayerGameQueue({
		accounts: {
			currentPlayerOne: currentPlayerOneAccount.publicKey,
			currentPlayerTwo: currentPlayerTwoAccount.publicKey,
			nextPlayerOne: nextPlayerOneAccount.publicKey,
			nextPlayerTwo: nextPlayerTwoAccount.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const updatedGameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);

	return { updatedGameQueueOne, updatedGameQueueTwo };
}

async function advanceTwoPlayerKingOfHillQueue(program, provider, winningPlayerAccount, losingPlayerAccount, gameQueueAccountOne, gameQueueAccountTwo, gameAccount) {
	await program.rpc.advanceTwoPlayerKingOfHillQueue({
		accounts: {
			winningPlayer: winningPlayerAccount.publicKey,
			losingPlayer: losingPlayerAccount.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const updatedGameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);

	return { updatedGameQueueOne, updatedGameQueueTwo };
}

async function advanceThreePlayerQueue(program, provider, currentPlayerOneAccount, currentPlayerTwoAccount, currentPlayerThreeAccount, nextPlayerOneAccount, nextPlayerTwoAccount, nextPlayerThreeAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount) {
	await program.rpc.advanceThreePlayerGameQueue({
		accounts: {
			currentPlayerOne: currentPlayerOneAccount.publicKey,
			currentPlayerTwo: currentPlayerTwoAccount.publicKey,
			currentPlayerThree: currentPlayerThreeAccount.publicKey,
			nextPlayerOne: nextPlayerOneAccount.publicKey,
			nextPlayerTwo: nextPlayerTwoAccount.publicKey,
			nextPlayerThree: nextPlayerThreeAccount.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const updatedGameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const updatedGameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);

	return { updatedGameQueueOne, updatedGameQueueTwo, updatedGameQueueThree };
}

async function advanceThreePlayerKingOfHillQueue(program, provider, winningPlayerAccount, losingPlayerAccountOne, losingPlayerAccountTwo, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount) {
	await program.rpc.advanceThreePlayerKingOfHillQueue({
		accounts: {
			winningPlayer: winningPlayerAccount.publicKey,
			losingPlayerAccountOne: losingPlayerAccountOne.publicKey,
			losingPlayerAccountTwo: losingPlayerAccountTwo.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const updatedGameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const updatedGameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);

	return { updatedGameQueueOne, updatedGameQueueTwo, updatedGameQueueThree };
}

module.exports = {
	advanceOnePlayerQueue,
	advanceTwoPlayerQueue,
	advanceTwoPlayerKingOfHillQueue,
	advanceThreePlayerQueue,
	advanceThreePlayerKingOfHillQueue,
};