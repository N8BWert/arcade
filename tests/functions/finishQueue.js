const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function finishOnePlayerGameQueue(program, provider, currentPlayerAccount, gameQueueAccount, gameAccount) {
	program.rpc.finishOnePlayerGameQueue({
		accounts: {
			currentPlayer: currentPlayerAccount.publicKey,
			gameQueueAccount: gameQueueAccount.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { updatedGame };
}

async function finishTwoPlayerGameQueue(program, provider, playerOneAccount, playerTwoAccount, gameQueueAccountOne, gameQueueAccountTwo, gameAccount) {
	program.rpc.finishTwoPlayerGameQueue({
		accounts: {
			playerOne: playerOneAccount.publicKey,
			playerTwo: playerTwoAccount.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { updatedGame };
}

async function finishTwoPlayerKingOfHillQueue(program, provider, losingPlayerAccount, gameQueueAccountOne, gameQueueAccountTwo, gameAccount) {
	program.rpc.finishTwoPlayerKingOfHillQueue({
		accounts: {
			losingPlayer: losingPlayerAccount.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { updatedGame };
}

async function finishThreePlayerGameQueue(program, provider, playerOneAccount, playerTwoAccount, playerThreeAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount) {
	program.rpc.finishThreePlayerGameQueue({
		accounts: {
			playerOne: playerOneAccount.publicKey,
			playerTwo: playerTwoAccount.publicKey,
			playerThree: playerThreeAccount.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { updatedGame };
}

async function finishThreePlayerKingOfHillQueue(program, provider, losingPlayerAccountOne, losingPlayerAccountTwo, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount) {
	program.rpc.finishThreePlayerKingOfHillQueue({
		accounts: {
			losingPlayerOne: losingPlayerAccountOne.publicKey,
			losingPlayerTwo: losingPlayerAccountTwo.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { updatedGame };
}

async function finishFourPlayerGameQueue(program, provider, playerOneAccount, playerTwoAccount, playerThreeAccount, playerFourAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount) {
	program.rpc.finishFourPlayerGameQueue({
		accounts: {
			playerOne: playerOneAccount.publicKey,
			playerTwo: playerTwoAccount.publicKey,
			playerThree: playerThreeAccount.publicKey,
			playerFour: playerFourAccount.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameQueueAccountFour: gameQueueAccountFour.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { updatedGame };
}

async function finishFourPlayerKingOfHillQueue(program, provider, losingPlayerAccountOne, losingPlayerAccountTwo, losingPlayerAccountThree, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount) {
	program.rpc.finishFourPlayerKingOfHillQueue({
		accounts: {
			losingPlayerOne: losingPlayerAccountOne.publicKey,
			losingPlayerTwo: losingPlayerAccountTwo.publicKey,
			losingPlayerThree: losingPlayerAccountThree.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameQueueAccountFour: gameQueueAccountFour.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { updatedGame };
}

async function finishTeamKingOfHillQueue(program, provider, losingPlayerAccountOne, losingPlayerAccountTwo, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount) {
	program.rpc.finishTeamKingOfHillQueue({
		accounts: {
			losingPlayerOne: losingPlayerAccountOne.publicKey,
			losingPlayerTwo: losingPlayerAccountTwo.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameQueueAccountFour: gameQueueAccountFour.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

	return { updatedGame };
}

module.exports = {
	finishOnePlayerGameQueue,
	finishTwoPlayerGameQueue,
	finishTwoPlayerKingOfHillQueue,
	finishThreePlayerGameQueue,
	finishThreePlayerKingOfHillQueue,
	finishFourPlayerGameQueue,
	finishFourPlayerKingOfHillQueue,
	finishTeamKingOfHillQueue,
};