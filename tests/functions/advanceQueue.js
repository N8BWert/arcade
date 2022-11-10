const anchor = require("@project-serum/anchor");

const { SystemProgram } = anchor.web3;

async function advanceOnePlayerQueue(program, provider, currentPlayerAccount, gameQueueAccount, gameAccount) {
	await program.rpc.advanceOnePlayerGameQueue({
		accounts: {
			currentPlayer: currentPlayerAccount.publicKey,
			gameQueueAccount: gameQueueAccount.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGameQueue = await program.account.gameQueue.fetch(gameQueueAccount.publicKey);

	return { updatedGameQueue };
}

async function advanceTwoPlayerQueue(program, provider, playerOneAccount, playerTwoAccount, gameQueueAccountOne, gameQueueAccountTwo, gameAccount) {
	await program.rpc.advanceTwoPlayerGameQueue({
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

async function advanceThreePlayerQueue(program, provider, playerOneAccount, playerTwoAccount, playerThreeAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount) {
	await program.rpc.advanceThreePlayerGameQueue({
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

async function advanceFourPlayerQueue(program, provider, playerOneAccount, playerTwoAccount, playerThreeAccount, playerFourAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount) {
	await program.rpc.advanceFourPlayerGameQueue({
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

	const updatedGameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const updatedGameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const updatedGameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
	const updatedGameQueueFour = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

	return { updatedGameQueueOne, updatedGameQueueTwo, updatedGameQueueThree, updatedGameQueueFour };
}

async function advanceFourPlayerKingOfHillQueue(program, provider, winningPlayerAccount, losingPlayerAccountOne, losingPlayerAccountTwo, losingPlayerAccountThree, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount) {
	await program.rpc.advanceThreePlayerKingOfHillQueue({
		accounts: {
			winningPlayer: winningPlayerAccount.publicKey,
			losingPlayerAccountOne: losingPlayerAccountOne.publicKey,
			losingPlayerAccountTwo: losingPlayerAccountTwo.publicKey,
			losingPlayerAccountThree: losingPlayerAccountThree.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameQueueAccountFour: gameQueueAccountFour.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const updatedGameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const updatedGameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
	const updatedGameQueueFour = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

	return { updatedGameQueueOne, updatedGameQueueTwo, updatedGameQueueThree, updatedGameQueueFour };
}

async function advanceTeamKingOfHillQueue(program, provider, winningPlayerAccountOne, winningPlayerAccountTwo, losingPlayerAccountOne, losingPlayerAccountTwo, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount) {
	await program.rpc.advanceThreePlayerKingOfHillQueue({
		accounts: {
			winningPlayerOne: winningPlayerAccountOne.publicKey,
			winningPlayerTwo: winningPlayerAccountTwo.publicKey,
			losingPlayerAccountOne: losingPlayerAccountOne.publicKey,
			losingPlayerAccountTwo: losingPlayerAccountTwo.publicKey,
			gameQueueAccountOne: gameQueueAccountOne.publicKey,
			gameQueueAccountTwo: gameQueueAccountTwo.publicKey,
			gameQueueAccountThree: gameQueueAccountThree.publicKey,
			gameQueueAccountFour: gameQueueAccountFour.publicKey,
			gameAccount: gameAccount.publicKey,
			authority: provider.wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	});

	const updatedGameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
	const updatedGameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
	const updatedGameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
	const updatedGameQueueFour = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

	return { updatedGameQueueOne, updatedGameQueueTwo, updatedGameQueueThree, updatedGameQueueFour };
}

module.exports = {
	advanceOnePlayerQueue,
	advanceTwoPlayerQueue,
	advanceTwoPlayerKingOfHillQueue,
	advanceThreePlayerQueue,
	advanceThreePlayerKingOfHillQueue,
	advanceFourPlayerQueue,
	advanceFourPlayerKingOfHillQueue,
	advanceTeamKingOfHillQueue,
};